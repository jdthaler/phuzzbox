# every page checked in a browser

### PhuzzBox (patch)
- `tools/check-pages.mjs`, Forte's: every page opened in headless Chromium at six sizes, from a
  phone to a desktop, failing on console errors, sideways scrolling, a pedal without its knobs,
  footswitch, ⓘ buttons or presets, and toggles that don't turn their view or controls off and on.
  CI runs it on every pull request and lists what differs from the base.
