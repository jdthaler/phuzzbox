// plugin-tests.cpp — the shared plugin (plugin/plugin.cpp) as a host drives it, built with the Wah:
// it offers a MIDI input; the FC-300's control changes move the rocker, the volume pedal and the
// bypass, and the host hears of each move; its state keeps the MIDI mappings.

#include <clap/clap.h>

#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

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
  p->stop_processing(p);
  p->deactivate(p);
  p->destroy(p);
  return failures ? 1 : 0;
}
