// pedals.cpp — every pedal the app plays, in the order its menu lists them: the pedals the site
// lists as ready (shared/registry.js; test/native-tests.mjs checks the two agree).

#include <string_view>
#include <vector>

#include "engine.h"

namespace buffer { const phuzzbox::PedalInfo &pedalInfo(); }
namespace phuzz { const phuzzbox::PedalInfo &pedalInfo(); }
namespace wah { const phuzzbox::PedalInfo &pedalInfo(); }

namespace phuzzbox::app {

const std::vector<const PedalInfo *> &pedals() {
  static const std::vector<const PedalInfo *> all{&buffer::pedalInfo(), &phuzz::pedalInfo(), &wah::pedalInfo()};
  return all;
}

const PedalInfo *findPedal(std::string_view slug) {
  for (const PedalInfo *p : pedals()) if (slug == p->slug) return p;
  return nullptr;
}

} // namespace phuzzbox::app
