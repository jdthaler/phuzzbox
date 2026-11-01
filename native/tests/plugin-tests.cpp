// plugin-tests.cpp — the shared plugin (plugin/plugin.cpp) as a host drives it, built with the Wah:
// it offers a MIDI input; the FC-300's control changes move the rocker, the volume pedal and the
// bypass, and the host hears of each move; its state keeps the MIDI mappings. Its window's calls
// (window.phuzz, plugin.cpp's call) set parameters the host is told of, show the host's moves, the
// levels and the window's own settings, which the state keeps.

#include <clap/clap.h>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "plugin.h"

bool phuzz_entry_init(const char *path);
const void *phuzz_entry_get_factory(const char *id);

static int failures = 0;
static void check(bool ok, const char *what) {
  std::printf("%s %s\n", ok ? "ok  " : "FAIL", what);
  if (!ok) failures++;
}

namespace {
clap_host_t host{CLAP_VERSION, nullptr, "tests", "phuzzbox", "", "0",
                 [](const clap_host_t *, const char *) -> const void * { return nullptr; },
                 [](const clap_host_t *) {}, [](const clap_host_t *) {}, [](const clap_host_t *) {}};

std::vector<clap_event_midi_t> midiIn;
uint32_t inSize(const clap_input_events_t *) { return (uint32_t)midiIn.size(); }
const clap_event_header_t *inGet(const clap_input_events_t *, uint32_t i) { return &midiIn[i].header; }
const clap_input_events_t inEvents{nullptr, inSize, inGet};
std::vector<clap_event_param_value_t> told;
bool outPush(const clap_output_events_t *, const clap_event_header_t *e) {
  if (e->type == CLAP_EVENT_PARAM_VALUE) told.push_back(*(const clap_event_param_value_t *)e);
  return true;
}
const clap_output_events_t outEvents{nullptr, outPush};

clap_event_midi_t cc(int number, int value, int channel = 0) {
  clap_event_midi_t e{};
  e.header = {sizeof e, 0, CLAP_CORE_EVENT_SPACE_ID, CLAP_EVENT_MIDI, 0};
  e.data[0] = (uint8_t)(0xB0 | channel); e.data[1] = (uint8_t)number; e.data[2] = (uint8_t)value;
  return e;
}

struct Stream { std::string s; size_t at = 0; };
} // namespace

int main() {
  phuzz_entry_init("");
  const auto *factory = (const clap_plugin_factory_t *)phuzz_entry_get_factory(CLAP_PLUGIN_FACTORY_ID);
  const clap_plugin_t *p = factory->create_plugin(factory, &host, factory->get_plugin_descriptor(factory, 0)->id);
  p->init(p);
  const auto *notes = (const clap_plugin_note_ports_t *)p->get_extension(p, CLAP_EXT_NOTE_PORTS);
  clap_note_port_info_t np{};
  check(notes && notes->count(p, true) == 1 && notes->get(p, 0, true, &np) && (np.supported_dialects & CLAP_NOTE_DIALECT_MIDI), "the plugin has a MIDI input");

  const auto *params = (const clap_plugin_params_t *)p->get_extension(p, CLAP_EXT_PARAMS);
  auto idOf = [&](const char *name) -> clap_id {
    for (uint32_t i = 0; i < params->count(p); i++) { clap_param_info_t info; params->get_info(p, i, &info); if (!std::strcmp(info.name, name)) return info.id; }
    return CLAP_INVALID_ID;
  };
  auto value = [&](clap_id id) { double v = NAN; params->get_value(p, id, &v); return v; };
  const clap_id rocker = idOf("Rocker"), volume = idOf("Volume pedal"), bypass = idOf("Bypass");
  check(rocker != CLAP_INVALID_ID && volume != CLAP_INVALID_ID && bypass != CLAP_INVALID_ID, "with Rocker, Volume pedal and Bypass parameters");

  p->activate(p, 48000, 1, 256);
  p->start_processing(p);
  std::vector<float> a(256), b(256), oa(256), ob(256);
  float *ins[2] = {a.data(), b.data()}, *outs[2] = {oa.data(), ob.data()};
  clap_audio_buffer_t ib{ins, nullptr, 2, 0, 0}, ob_{outs, nullptr, 2, 0, 0};
  auto run = [&](std::vector<clap_event_midi_t> evs) {
    midiIn = evs;
    told.clear();
    clap_process_t pr{};
    pr.frames_count = 256; pr.audio_inputs = &ib; pr.audio_outputs = &ob_; pr.audio_inputs_count = 1; pr.audio_outputs_count = 1;
    pr.in_events = &inEvents; pr.out_events = &outEvents; pr.steady_time = -1;
    p->process(p, &pr);
  };
  run({cc(1, 0), cc(7, 64), cc(65, 0)});
  check(value(rocker) == 0, "CC 1 at 0 puts the rocker heel down");
  check(std::abs(value(volume) - 64 / 127.0) < 1e-12, "CC 7 sets the volume pedal");
  check(value(bypass) == 1, "number pedal 1 (CC 65) at 0 bypasses, latching");
  check(told.size() == 3, "and the host is told of all three");
  run({cc(65, 127)});
  check(value(bypass) == 0, "and at 127 engages");
  run({cc(20, 100)});
  check(told.empty(), "a CC nothing is mapped to does nothing");

  const auto *state = (const clap_plugin_state_t *)p->get_extension(p, CLAP_EXT_STATE);
  Stream s;
  clap_ostream_t os{&s, [](const clap_ostream_t *o, const void *buf, uint64_t n) -> int64_t { ((Stream *)o->ctx)->s.append((const char *)buf, n); return (int64_t)n; }};
  state->save(p, &os);
  check(s.s.find("midi 1 0 position 0 0") != std::string::npos && s.s.find("midi 7 0 volume") != std::string::npos, "the state keeps the MIDI mappings");
  // a state whose only mapping is CC 4 to the rocker: CC 1 then does nothing, CC 4 moves it
  Stream t{"phuzzbox wah 1\nposition 0.5\nmidi 4 0 position 0 1\n"};
  clap_istream_t is{&t, [](const clap_istream_t *i, void *buf, uint64_t n) -> int64_t {
    Stream *st = (Stream *)i->ctx; const size_t k = std::min<size_t>(n, st->s.size() - st->at);
    std::memcpy(buf, st->s.data() + st->at, k); st->at += k; return (int64_t)k; }};
  state->load(p, &is);
  run({cc(1, 127)});
  check(value(rocker) == 0.5, "a loaded state's mappings replace the defaults");
  run({cc(4, 127)});
  check(value(rocker) == 0, "and a reversed pedal turns the other way");

  // the window (window.phuzz): what it sets reaches the audio and the host; what the host or a
  // MIDI pedal moves, and the levels, reach the window
  const auto *win = (const phuzzbox::WindowCalls *)p->get_extension(p, phuzzbox::kWindowCalls);
  check(win != nullptr, "the window's calls answer without a window");
  if (win) {
    const std::string d = win->call(p, "[\"describe\"]");
    check(d.find("\"host\": \"plugin\"") != std::string::npos && d.find("\"position\": 0") != std::string::npos && d.find("\"pedal\": \"wah\"") != std::string::npos,
          "describe names the plugin, the pedal and its parameters' values");
    win->call(p, "[\"set\", \"position\", 0.25]");
    run({});
    check(value(rocker) == 0.25, "a knob turned in the window moves the parameter");
    bool heard = false;
    for (auto &e : told) heard |= e.param_id == rocker && e.value == 0.25;
    check(heard, "and the host is told of it");
    std::string q = win->call(p, "[\"poll\"]");
    check(q.find("\"position\"") == std::string::npos, "a poll doesn't send the window back its own move");
    run({cc(4, 0)});
    q = win->call(p, "[\"poll\"]");
    check(q.find("\"position\": 1") != std::string::npos, "a move the window didn't make (a MIDI pedal's) shows in its next poll");
    win->call(p, "[\"bypass\", 1]");
    run({});
    check(value(bypass) == 1, "the window's footswitch bypasses");
    for (int i = 0; i < 256; i++) a[i] = b[i] = 0.5f * (float)std::sin(2 * 3.14159265 * 110 * i / 48000.0);
    run({});
    q = win->call(p, "[\"poll\"]");
    check(q.find("\"in\": 0.49") != std::string::npos || q.find("\"in\": 0.5") != std::string::npos, "the window's input meter reads the peak volts");
    win->call(p, "[\"mute\", true]");
    for (int k = 0; k < 20; k++) run({});
    float loud = 0;
    for (float x : oa) loud = std::max(loud, std::abs(x));
    check(loud < 1e-4f, "Mute (for tuning) silences the output");
    win->call(p, "[\"mute\", false]");
    win->call(p, "[\"store\", \"layout\", {\"views\": 0.4}]");
    Stream w;
    clap_ostream_t wo{&w, [](const clap_ostream_t *o, const void *buf, uint64_t n) -> int64_t { ((Stream *)o->ctx)->s.append((const char *)buf, n); return (int64_t)n; }};
    state->save(p, &wo);
    check(w.s.find("window {\"layout\":") != std::string::npos, "the state keeps the window's layout");
    clap_istream_t wi{&w, [](const clap_istream_t *i, void *buf, uint64_t n) -> int64_t {
      Stream *st = (Stream *)i->ctx; const size_t k = std::min<size_t>(n, st->s.size() - st->at);
      std::memcpy(buf, st->s.data() + st->at, k); st->at += k; return (int64_t)k; }};
    win->call(p, "[\"store\", \"layout\", {}]");
    state->load(p, &wi);
    check(win->call(p, "[\"describe\"]").find("\"views\": 0.4") != std::string::npos, "and gives it back to the window");
  }
  p->stop_processing(p);
  p->deactivate(p);
  p->destroy(p);
  return failures ? 1 : 0;
}
