// pedals.cpp — every pedal the app plays, in the order its menu lists them: the pedals the site
// lists as ready (shared/registry.js; test/native-tests.mjs checks the two agree).

#include <string_view>
#include <vector>

#include "engine.h"

namespace buffer { const phuzzbox::PedalInfo &pedalInfo(); }
namespace phuzz { const phuzzbox::PedalInfo &pedalInfo(); }
namespace wah { const phuzzbox::PedalInfo &pedalInfo(); }
namespace preamp { const phuzzbox::PedalInfo &pedalInfo(); }
namespace opto { const phuzzbox::PedalInfo &pedalInfo(); }
namespace cabinet { const phuzzbox::PedalInfo &pedalInfo(); }
namespace envelope { const phuzzbox::PedalInfo &pedalInfo(); }
namespace octave { const phuzzbox::PedalInfo &pedalInfo(); }
namespace spring { const phuzzbox::PedalInfo &pedalInfo(); }
namespace echo { const phuzzbox::PedalInfo &pedalInfo(); }
namespace rotary { const phuzzbox::PedalInfo &pedalInfo(); }
namespace plate { const phuzzbox::PedalInfo &pedalInfo(); }
namespace sympathetic { const phuzzbox::PedalInfo &pedalInfo(); }
namespace blackhole { const phuzzbox::PedalInfo &pedalInfo(); }
namespace doppler { const phuzzbox::PedalInfo &pedalInfo(); }
namespace bandgap { const phuzzbox::PedalInfo &pedalInfo(); }
namespace michelson { const phuzzbox::PedalInfo &pedalInfo(); }
namespace lampvibe { const phuzzbox::PedalInfo &pedalInfo(); }
namespace cable { const phuzzbox::PedalInfo &pedalInfo(); }
namespace ringmod { const phuzzbox::PedalInfo &pedalInfo(); }
namespace radio { const phuzzbox::PedalInfo &pedalInfo(); }
namespace tunnel { const phuzzbox::PedalInfo &pedalInfo(); }
namespace transformer { const phuzzbox::PedalInfo &pedalInfo(); }
namespace openair { const phuzzbox::PedalInfo &pedalInfo(); }
namespace sabine { const phuzzbox::PedalInfo &pedalInfo(); }
namespace bbd { const phuzzbox::PedalInfo &pedalInfo(); }
namespace neon { const phuzzbox::PedalInfo &pedalInfo(); }
namespace lens { const phuzzbox::PedalInfo &pedalInfo(); }

namespace phuzzbox::app {

const std::vector<const PedalInfo *> &pedals() {
  static const std::vector<const PedalInfo *> all{&buffer::pedalInfo(), &phuzz::pedalInfo(), &wah::pedalInfo(), &preamp::pedalInfo(), &transformer::pedalInfo(), &bandgap::pedalInfo(), &cable::pedalInfo(), &ringmod::pedalInfo(), &radio::pedalInfo(), &tunnel::pedalInfo(), &opto::pedalInfo(), &lampvibe::pedalInfo(), &neon::pedalInfo(), &michelson::pedalInfo(), &cabinet::pedalInfo(), &envelope::pedalInfo(), &octave::pedalInfo(), &spring::pedalInfo(), &echo::pedalInfo(), &bbd::pedalInfo(), &rotary::pedalInfo(), &openair::pedalInfo(), &sabine::pedalInfo(), &plate::pedalInfo(), &sympathetic::pedalInfo(), &blackhole::pedalInfo(), &lens::pedalInfo(), &doppler::pedalInfo()};
  return all;
}

const PedalInfo *findPedal(std::string_view slug) {
  for (const PedalInfo *p : pedals()) if (slug == p->slug) return p;
  return nullptr;
}

} // namespace phuzzbox::app
