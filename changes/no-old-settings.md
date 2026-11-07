# no shims for old settings

### PhuzzBox (patch)
- Settings saved by earlier versions are no longer converted, since nothing is promised before 1.0:
  the MIDI panel keeps whatever layout a page saved, even the old default one (number pedal 2 as
  Mute), the rig card no longer reads the setting it had when it was the bass card, and the app no
  longer reads the Buffer's parameters from where the first app kept them.
- A plugin whose saved state has no MIDI mappings now opens with none, instead of the default
  layout, so clearing them all sticks.
- The app's settings folder is spelled as its name, `PhuzzBox`, on macOS and Windows (both ignore
  case, so it is the same folder).
- `node tools/release.mjs --check-pr` no longer warns when a change breaks songs saved with a
  pedal below 1.0; from 1.0 on it still asks for a major note.
