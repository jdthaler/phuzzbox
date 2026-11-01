# Notes for the next release

A pull request into `main` bumps no version. It adds one note here instead, a Markdown file with
any name (say, the branch's topic: `spring-pickups.md`), saying what it changes and how much:

```markdown
# the spring reverb's pickups move

### PhuzzBox (patch)
- The tuner's display no longer …

### Spring Reverb (minor)
- **Pickup position:** a knob for where along the spring the pickup sits, …
```

- The first line, `# <topic>`, is a few words on the change; the release's `CHANGELOG.md` heading
  joins the topics of every note it gathers.
- Each `### <name> (<kind>)` section is PhuzzBox (`shared/`, the landing page, the Pedalboard, the
  test bass, the tuner, the scope and spectrum pages, `tools/`, the app in `native/app/`, the
  plugins' shared code in `native/core/` and `native/plugin/`) or a pedal, by its name in
  `shared/registry.js` (a pedal covers its folder, its tests and its port in
  `native/pedals/<id>/`). Its lines go under that name's new version in `CHANGELOG.md`, as they
  are.
- The kind is `minor` (something new, or a change to the sound or the parameters), `patch` (a fix
  that changes neither), `major` (a change that breaks songs saved with the plugins: see below) or
  `new` (a pedal's first release: give it `ready: true` and its first version, `0.1.0`, in
  `shared/registry.js`). `major` takes 0.x to 1.0.0.
- From 1.0 on, a pedal whose contract breaks needs `major`: removing, renaming or rescaling a
  parameter, changing its default, moving or removing a choice's option or a preset, or changing a
  preset's values (`tools/contract.mjs`; `node tools/contract.mjs` lists them). Below 1.0 the
  `tests` workflow only warns.
- Changes to the documentation (Markdown at the top level, in `docs/` and in `native/`) and to CI
  need no note. A pedal's README is its page's How it works, so it does.

`npm test` checks the notes (`test/site-tests.mjs`), and the `tests` workflow checks that a pull
request into `main` adds one when it changes the site or the plugins and changes no version.

Releasing (`CLAUDE.md`) runs `node tools/release.mjs` on a branch off `main`, which gathers the
notes into one `CHANGELOG.md` entry, bumps each version once by the largest kind its notes give
(PhuzzBox in `package.json` and `PHUZZBOX_VERSION` together), regenerates the plugins'
`<slug>-info.cmake` and deletes the notes. `--dry-run` shows it first.
