// plugin.cpp — the CLAP effect every pedal shares: stereo in (summed to the pedal's mono input),
// stereo out, its parameters, a Bypass, a Volume pedal and a Preset parameter, its state, latency
// and tail, and a MIDI input whose control changes move them (phuzzbox/midi.h: a foot controller's
// expression pedals and switches, the FC-300's numbers by default). The DAW draws its generic
// panel. clap-wrapper makes the VST3 (whose hosts send CCs through IMidiMapping), AU (an effect,
// aufx: the host maps CCs to parameters itself) and standalone (with RtMidi's input) from it.

#include "plugin.h"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#include <clap/clap.h>

#include "phuzzbox/denormals.h"
#include "phuzzbox/dryline.h"
#include "phuzzbox/guard.h"
#include "phuzzbox/midi.h"

namespace phuzzbox {
namespace {

const PedalInfo *pedal = nullptr;
clap_plugin_descriptor_t descriptor{};
std::string pluginId, versionText;

// The plugin's parameters: the pedal's, then Bypass (the footswitch: 1 bypassed), Volume pedal
// (a position 0…1 along an audio-taper pot after the pedal, 1 full), then Preset (a choice of "—"
// and the pedal's presets), whose choice sets the others once and then reads "—" again.
int bypassIndex() { return pedal->paramCount; }
int volumeIndex() { return pedal->paramCount + 1; }
int presetIndex() { return pedal->presetCount ? pedal->paramCount + 2 : -1; }
int paramCount() { return pedal->paramCount + 2 + (pedal->presetCount ? 1 : 0); }
uint32_t paramId(int i) {
  if (i < pedal->paramCount) return paramHash(pedal->params[i].id);
  return paramHash(i == bypassIndex() ? "phuzz.bypass" : i == volumeIndex() ? "phuzz.volume" : "preset");
}
int paramIndex(clap_id id) {
  for (int i = 0; i < paramCount(); i++) if (paramId(i) == id) return i;
  return -1;
}
// a MIDI target as the state writes it: the parameter's id, or bypass or volume
const char *targetName(int t) { return t == MIDI_BYPASS ? "bypass" : t == MIDI_VOLUME ? "volume" : t >= 0 && t < pedal->paramCount ? pedal->params[t].id : nullptr; }
bool targetFrom(const std::string &s, int16_t &t) {
  if (s == "bypass") { t = MIDI_BYPASS; return true; }
  if (s == "volume") { t = MIDI_VOLUME; return true; }
  for (int i = 0; i < pedal->paramCount; i++) if (s == pedal->params[i].id) { t = (int16_t)i; return true; }
  return false;
}

struct Plugin {
  clap_plugin_t clap{};
  const clap_host_t *host;
  std::unique_ptr<Effect> effect;
  std::vector<std::atomic<double>> values;
  std::vector<double> P;
  std::atomic<bool> dirty{true};
  std::vector<float> in, L, R;
  double fs = 48000;
  std::atomic<double> bypass{0}, volume{1};
  double wet = 1, gain = 1;          // the bypass's crossfade and the volume's gain, as they glide
  DryLine dry;                       // the dry signal, as late as the pedal (its latency)
  MidiMap midi, midiMain, midiPending; // the audio thread's, the main thread's, and one on its way
  std::atomic<bool> midiNew{false};

  explicit Plugin(const clap_host_t *h) : host(h), values(pedal->paramCount), P(pedal->paramCount) {
    for (int i = 0; i < pedal->paramCount; i++) values[i] = pedal->params[i].def;
    midi.defaults(*pedal);
    midiMain = midi;
  }
  double value(int i) const {
    if (i < pedal->paramCount) return values[i];
    return i == bypassIndex() ? bypass.load() : i == volumeIndex() ? volume.load() : 0;
  }
  void set(int i, double v) {
    if (i < pedal->paramCount) { values[i] = constrain(pedal->params[i], v); dirty = true; return; }
    if (i == bypassIndex()) { bypass = v >= 0.5 ? 1 : 0; return; }
    if (i == volumeIndex()) { volume = std::isfinite(v) ? std::clamp(v, 0.0, 1.0) : 1.0; return; }
    const int k = (int)v - 1; // Preset: 0 is "—"
    if (k < 0 || k >= pedal->presetCount) return;
    const Preset &p = pedal->presets[k];
    for (int j = 0; j < p.count; j++) values[p.values[j].param] = constrain(pedal->params[p.values[j].param], p.values[j].value);
    dirty = true;
  }
  void apply() {
    if (!dirty.exchange(false)) return;
    for (int i = 0; i < pedal->paramCount; i++) P[i] = values[i];
    effect->setParams(P.data());
  }
  // a MIDI CC's move, and the host told of the parameter's new value so its panel follows
  void midiSet(int i, double v, uint32_t time, const clap_output_events_t *out) {
    set(i, v);
    if (!out) return;
    clap_event_param_value_t ev{};
    ev.header.size = sizeof ev;
    ev.header.time = time;
    ev.header.space_id = CLAP_CORE_EVENT_SPACE_ID;
    ev.header.type = CLAP_EVENT_PARAM_VALUE;
    ev.param_id = paramId(i);
    ev.note_id = -1; ev.port_index = -1; ev.channel = -1; ev.key = -1;
    ev.value = value(i);
    out->try_push(out, &ev.header);
  }
  void events(const clap_input_events_t *evs, const clap_output_events_t *out) {
    if (midiNew.exchange(false)) midi = midiPending;
    if (!evs) return;
    for (uint32_t k = 0, n = evs->size(evs); k < n; k++) {
      const clap_event_header_t *e = evs->get(evs, k);
      if (e->space_id != CLAP_CORE_EVENT_SPACE_ID) continue;
      if (e->type == CLAP_EVENT_PARAM_VALUE) {
        const auto *pv = (const clap_event_param_value_t *)e;
        const int i = paramIndex(pv->param_id);
        if (i >= 0) set(i, pv->value);
      } else if (e->type == CLAP_EVENT_MIDI) {
        const auto *m = (const clap_event_midi_t *)e;
        midi.handle(m->data, 3, *pedal, [&](int t, char kind, double v) {
          if (t == MIDI_VOLUME) midiSet(volumeIndex(), v, e->time, out);
          else if (t == MIDI_BYPASS) midiSet(bypassIndex(), kind == 't' ? 1 - bypass.load() : 1 - v, e->time, out);
          else if (kind == 'c') midiSet(t, fromNormalized(pedal->params[t], v), e->time, out);
          else if (kind == 't') midiSet(t, 1 - values[t].load(), e->time, out);
          else midiSet(t, v, e->time, out);
        }, [&](int t) { return t < pedal->paramCount && pedal->params[t].kind == ParamKind::choice ? pedal->params[t].choiceCount : 0; });
      }
    }
  }
};

Plugin *self(const clap_plugin_t *p) { return (Plugin *)p->plugin_data; }

bool init(const clap_plugin_t *) { return true; }
void destroy(const clap_plugin_t *p) { delete self(p); }
bool activate(const clap_plugin_t *p, double fs, uint32_t, uint32_t maxFrames) {
  Plugin *s = self(p);
  s->fs = fs;
  s->effect.reset(pedal->create(fs));
  s->in.assign(maxFrames, 0);
  s->L.assign(maxFrames, 0);
  s->R.assign(maxFrames, 0);
  s->dirty = true;
  s->apply();
  s->wet = 1 - s->bypass.load();
  s->dry.reset();
  s->gain = audioTaper(s->volume.load());
  return true;
}
void deactivate(const clap_plugin_t *p) { self(p)->effect.reset(); }
bool startProcessing(const clap_plugin_t *) { return true; }
void stopProcessing(const clap_plugin_t *) {}
void reset(const clap_plugin_t *p) { if (self(p)->effect) self(p)->effect->reset(); }

clap_process_status process(const clap_plugin_t *p, const clap_process_t *proc) {
  Plugin *s = self(p);
  NoDenormals ftz;
  s->events(proc->in_events, proc->out_events);
  s->apply();
  const uint32_t n = proc->frames_count;
  if (!proc->audio_outputs_count || !s->effect) return CLAP_PROCESS_CONTINUE;
  const clap_audio_buffer_t &out = proc->audio_outputs[0];
  float *oL = out.data32[0], *oR = out.channel_count > 1 ? out.data32[1] : nullptr;
  for (uint32_t at = 0; at < n;) {
    const uint32_t m = std::min<uint32_t>(128, n - at);
    // the input: a mono line, or a stereo pair's mean
    if (proc->audio_inputs_count && proc->audio_inputs[0].channel_count) {
      const clap_audio_buffer_t &inb = proc->audio_inputs[0];
      const float *a = inb.data32[0] + at, *b = inb.channel_count > 1 ? inb.data32[1] + at : a;
      for (uint32_t i = 0; i < m; i++) s->in[i] = 0.5f * (a[i] + b[i]);
    } else {
      std::fill(s->in.begin(), s->in.begin() + m, 0.0f);
    }
    s->effect->process(s->in.data(), s->L.data(), s->R.data(), (int)m);
    if (!guardBlock(s->L.data(), s->R.data(), (int)m)) s->effect->reset();
    // the bypass crossfades and the volume pedal glides, each over about 10 ms, without a click
    const double k = 1 - std::exp(-1 / (0.010 * s->fs));
    const double wetTo = 1 - s->bypass.load(), gainTo = audioTaper(s->volume.load());
    s->dry.setDelay(s->effect->latency());
    for (uint32_t i = 0; i < m; i++) {
      s->wet += (wetTo - s->wet) * k;
      s->gain += (gainTo - s->gain) * k;
      const double dry = s->dry.run(s->in[i]);
      oL[at + i] = (float)(s->gain * (s->wet * s->L[i] + (1 - s->wet) * dry));
      if (oR) oR[at + i] = (float)(s->gain * (s->wet * s->R[i] + (1 - s->wet) * dry));
    }
    at += m;
  }
  return CLAP_PROCESS_CONTINUE;
}

// audio ports: one stereo in, one stereo out
uint32_t portsCount(const clap_plugin_t *, bool) { return 1; }
bool portsGet(const clap_plugin_t *, uint32_t index, bool isInput, clap_audio_port_info_t *info) {
  if (index) return false;
  info->id = isInput ? 0 : 1;
  std::snprintf(info->name, sizeof info->name, "%s", isInput ? "Input" : "Output");
  info->flags = CLAP_AUDIO_PORT_IS_MAIN;
  info->channel_count = 2;
  info->port_type = CLAP_PORT_STEREO;
  info->in_place_pair = CLAP_INVALID_ID;
  return true;
}
const clap_plugin_audio_ports_t audioPorts{portsCount, portsGet};

// note ports: one MIDI input, for a foot controller's control changes
uint32_t notePortsCount(const clap_plugin_t *, bool isInput) { return isInput ? 1 : 0; }
bool notePortsGet(const clap_plugin_t *, uint32_t index, bool isInput, clap_note_port_info_t *info) {
  if (index || !isInput) return false;
  info->id = 0;
  info->supported_dialects = CLAP_NOTE_DIALECT_MIDI;
  info->preferred_dialect = CLAP_NOTE_DIALECT_MIDI;
  std::snprintf(info->name, sizeof info->name, "MIDI pedals");
  return true;
}
const clap_plugin_note_ports_t notePorts{notePortsCount, notePortsGet};

// parameters
uint32_t paramsCount(const clap_plugin_t *) { return (uint32_t)paramCount(); }
bool paramsInfo(const clap_plugin_t *, uint32_t i, clap_param_info_t *info) {
  if ((int)i >= paramCount()) return false;
  std::memset(info, 0, sizeof *info);
  info->id = paramId((int)i);
  if ((int)i == bypassIndex()) {
    std::snprintf(info->name, sizeof info->name, "Bypass");
    info->flags = CLAP_PARAM_IS_STEPPED | CLAP_PARAM_IS_BYPASS | CLAP_PARAM_IS_AUTOMATABLE;
    info->min_value = 0; info->max_value = 1; info->default_value = 0;
    return true;
  }
  if ((int)i == volumeIndex()) {
    std::snprintf(info->name, sizeof info->name, "Volume pedal");
    info->flags = CLAP_PARAM_IS_AUTOMATABLE;
    info->min_value = 0; info->max_value = 1; info->default_value = 1;
    return true;
  }
  if ((int)i == presetIndex()) {
    std::snprintf(info->name, sizeof info->name, "Preset");
    info->flags = CLAP_PARAM_IS_STEPPED | CLAP_PARAM_IS_ENUM;
    info->min_value = 0;
    info->max_value = pedal->presetCount;
    info->default_value = 0;
    return true;
  }
  const ParamInfo &p = pedal->params[i];
  std::snprintf(info->name, sizeof info->name, "%s", p.label);
  std::snprintf(info->module, sizeof info->module, "%s", p.group);
  info->flags = CLAP_PARAM_IS_AUTOMATABLE | (p.kind != ParamKind::continuous ? CLAP_PARAM_IS_STEPPED : 0) | (p.kind == ParamKind::choice ? CLAP_PARAM_IS_ENUM : 0);
  info->min_value = p.min;
  info->max_value = p.max;
  info->default_value = p.def;
  return true;
}
bool paramsValue(const clap_plugin_t *pl, clap_id id, double *v) {
  const int i = paramIndex(id);
  if (i < 0) return false;
  *v = self(pl)->value(i);
  return true;
}
bool paramsToText(const clap_plugin_t *, clap_id id, double v, char *out, uint32_t size) {
  const int i = paramIndex(id);
  if (i < 0) return false;
  if (i == presetIndex()) { const int k = (int)v - 1; std::snprintf(out, size, "%s", k >= 0 && k < pedal->presetCount ? pedal->presets[k].name : "—"); return true; }
  if (i == bypassIndex()) { std::snprintf(out, size, "%s", v >= 0.5 ? "bypassed" : "engaged"); return true; }
  if (i == volumeIndex()) { std::snprintf(out, size, "%.0f %%", 100 * std::clamp(v, 0.0, 1.0)); return true; }
  formatValue(pedal->params[i], v, out, size);
  return true;
}
bool paramsFromText(const clap_plugin_t *, clap_id id, const char *text, double *v) {
  const int i = paramIndex(id);
  if (i < 0) return false;
  if (i == presetIndex()) {
    for (int k = 0; k < pedal->presetCount; k++) if (!std::strcmp(text, pedal->presets[k].name)) { *v = k + 1; return true; }
    return false;
  }
  if (i == bypassIndex()) {
    if (!std::strcmp(text, "bypassed")) { *v = 1; return true; }
    if (!std::strcmp(text, "engaged")) { *v = 0; return true; }
    return false;
  }
  if (i == volumeIndex()) { char *end = nullptr; const double x = std::strtod(text, &end); if (end == text) return false; *v = std::clamp(x / 100, 0.0, 1.0); return true; }
  return parseValue(pedal->params[i], text, *v);
}
void paramsFlush(const clap_plugin_t *pl, const clap_input_events_t *in, const clap_output_events_t *out) {
  Plugin *s = self(pl);
  s->events(in, out);
  if (s->effect) s->apply();
}
const clap_plugin_params_t params{paramsCount, paramsInfo, paramsValue, paramsToText, paramsFromText, paramsFlush};

// state: "phuzzbox <slug> 1" then a line "<id> <value>" for each parameter, by id so that a later
// version with more parameters still reads it, the bypass and volume pedal as "phuzz.bypass" and
// "phuzz.volume", and a line "midi <cc> <channel> <target> <momentary> <invert>" for each mapping
// (target: a parameter's id, bypass or volume)
bool stateSave(const clap_plugin_t *pl, const clap_ostream_t *stream) {
  std::ostringstream o;
  o.precision(17);
  o << "phuzzbox " << pedal->slug << " 1\n";
  const Plugin *p = self(pl);
  for (int i = 0; i < pedal->paramCount; i++) o << pedal->params[i].id << ' ' << p->values[i].load() << '\n';
  o << "phuzz.bypass " << p->bypass.load() << "\nphuzz.volume " << p->volume.load() << '\n';
  for (int k = 0; k < p->midiMain.count; k++) {
    const MidiMapping &m = p->midiMain.maps[k];
    if (const char *t = targetName(m.target)) o << "midi " << (int)m.cc << ' ' << (int)m.channel << ' ' << t << ' ' << (int)m.momentary << ' ' << (int)m.invert << '\n';
  }
  const std::string s = o.str();
  for (size_t at = 0; at < s.size();) {
    const int64_t w = stream->write(stream, s.data() + at, s.size() - at);
    if (w <= 0) return false;
    at += (size_t)w;
  }
  return true;
}
bool stateLoad(const clap_plugin_t *pl, const clap_istream_t *stream) {
  std::string s;
  char buf[4096];
  for (int64_t r; (r = stream->read(stream, buf, sizeof buf)) > 0;) s.append(buf, (size_t)r);
  std::istringstream in(s);
  std::string magic, slug, id;
  int version = 0;
  if (!(in >> magic >> slug >> version) || magic != "phuzzbox" || slug != pedal->slug) return false;
  Plugin *p = self(pl);
  MidiMap map;
  bool anyMidi = false;
  std::string line;
  std::getline(in, line);
  while (std::getline(in, line)) {
    std::istringstream l(line);
    if (!(l >> id)) continue;
    if (id == "midi") {
      int cc, channel, momentary, invert;
      std::string target;
      MidiMapping m;
      if (l >> cc >> channel >> target >> momentary >> invert && targetFrom(target, m.target)) {
        m.cc = (uint8_t)std::clamp(cc, 0, 119); m.channel = (uint8_t)std::clamp(channel, 0, 16);
        m.momentary = momentary != 0; m.invert = invert != 0;
        map.add(m);
      }
      anyMidi = true;
      continue;
    }
    double v;
    if (!(l >> v)) continue;
    if (id == "phuzz.bypass") p->set(bypassIndex(), v);
    else if (id == "phuzz.volume") p->set(volumeIndex(), v);
    else for (int i = 0; i < pedal->paramCount; i++) if (id == pedal->params[i].id) p->set(i, v);
  }
  if (!anyMidi) map.defaults(*pedal); // a state from before the MIDI input
  p->midiMain = map;
  p->midiPending = map;
  p->midiNew = true;
  if (auto hp = (const clap_host_params_t *)p->host->get_extension(p->host, CLAP_EXT_PARAMS)) hp->rescan(p->host, CLAP_PARAM_RESCAN_VALUES);
  return true;
}
const clap_plugin_state_t state{stateSave, stateLoad};

uint32_t latencyGet(const clap_plugin_t *pl) { return self(pl)->effect ? (uint32_t)self(pl)->effect->latency() : 0; }
const clap_plugin_latency_t latency{latencyGet};
uint32_t tailGet(const clap_plugin_t *pl) {
  const Plugin *s = self(pl);
  return s->effect ? (uint32_t)(s->effect->tail() * s->fs + 0.5) : 0;
}
const clap_plugin_tail_t tail{tailGet};

const void *getExtension(const clap_plugin_t *, const char *id) {
  if (!std::strcmp(id, CLAP_EXT_AUDIO_PORTS)) return &audioPorts;
  if (!std::strcmp(id, CLAP_EXT_NOTE_PORTS)) return &notePorts;
  if (!std::strcmp(id, CLAP_EXT_PARAMS)) return &params;
  if (!std::strcmp(id, CLAP_EXT_STATE)) return &state;
  if (!std::strcmp(id, CLAP_EXT_LATENCY)) return &latency;
  if (!std::strcmp(id, CLAP_EXT_TAIL)) return &tail;
  return nullptr;
}
void onMainThread(const clap_plugin_t *) {}

uint32_t factoryCount(const clap_plugin_factory_t *) { return 1; }
const clap_plugin_descriptor_t *factoryDescriptor(const clap_plugin_factory_t *, uint32_t i) { return i == 0 ? &descriptor : nullptr; }
const clap_plugin_t *factoryCreate(const clap_plugin_factory_t *, const clap_host_t *host, const char *id) {
  if (std::strcmp(id, descriptor.id)) return nullptr;
  Plugin *s = new Plugin(host);
  s->clap.desc = &descriptor;
  s->clap.plugin_data = s;
  s->clap.init = init;
  s->clap.destroy = destroy;
  s->clap.activate = activate;
  s->clap.deactivate = deactivate;
  s->clap.start_processing = startProcessing;
  s->clap.stop_processing = stopProcessing;
  s->clap.reset = reset;
  s->clap.process = process;
  s->clap.get_extension = getExtension;
  s->clap.on_main_thread = onMainThread;
  return &s->clap;
}
const clap_plugin_factory_t factory{factoryCount, factoryDescriptor, factoryCreate};

const char *features[] = {CLAP_PLUGIN_FEATURE_AUDIO_EFFECT, CLAP_PLUGIN_FEATURE_STEREO, nullptr};

} // namespace

bool entryInit(const PedalInfo &info) {
  pedal = &info;
  pluginId = std::string("net.jthaler.phuzzbox.") + info.slug;
  versionText = info.version;
  descriptor.clap_version = CLAP_VERSION;
  descriptor.id = pluginId.c_str();
  descriptor.name = info.name;
  descriptor.vendor = "PhuzzBox";
  descriptor.url = "https://phuzzbox.jthaler.net";
  descriptor.manual_url = "";
  descriptor.support_url = "";
  descriptor.version = versionText.c_str();
  descriptor.description = info.description;
  descriptor.features = features;
  return true;
}

const void *entryFactory(const char *id) { return !std::strcmp(id, CLAP_PLUGIN_FACTORY_ID) ? &factory : nullptr; }

} // namespace phuzzbox
