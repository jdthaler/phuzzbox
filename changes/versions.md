# versions, release notes and a changelog, as Forte's

### PhuzzBox (minor)
- **Versions that move:** PhuzzBox and each pedal keep their own semantic version, as Forte and
  its instruments do. A change leaves a note in `changes/`; a release gathers the notes into
  `CHANGELOG.md` and bumps each version named once (`node tools/release.mjs`), and the plugins and
  the app carry the new versions.
- The front page shows each pedal's version on its tile, beside PhuzzBox's at the foot.
- **Saved songs are guarded:** each pedal's parameters and presets are listed in
  `native/pedals/<id>/<id>-contract.json`, generated from its descriptor, and `tools/contract.mjs`
  says what a change would break in a song saved with the plugins. The `tests` workflow warns
  about a break now and, from a pedal's 1.0 on, will ask for a major version.
