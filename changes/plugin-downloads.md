# plugins to download

### PhuzzBox (minor)
- **Plugins and the app to download:** a Plugins tab in How it works on every page (and on the front
  page, Plugins and the app) downloads the latest plugin release's files: on a pedal's page that
  pedal for macOS, Windows or Linux, and everywhere every pedal with the PhuzzBox app, or the app
  alone, with a line saying which release they are. Below them, how to install them on each system.
- Each archive has every format its system builds (AU, VST3, CLAP and standalone apps), the guide,
  `install.sh` on macOS and Linux (`bash install.sh install`), the licence and
  `THIRD-PARTY-NOTICES.md`. The macOS bundles are signed ad hoc so Apple silicon loads them.
- `tools/package-plugins.sh` packs them in every `native` run, and the `release-plugins` workflow
  publishes `live`'s as a GitHub release after each site release that changes them.
