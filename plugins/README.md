# Plugins and the app

Every pedal on the site is also a plugin, built from the same C++ physics, so it sounds the same:
an Audio Unit (AU) on a Mac, and VST3 and CLAP on macOS, Windows and Linux, for Logic, MainStage,
GarageBand, Ableton Live, Reaper, Bitwig and the rest. Put one on an audio track or a channel strip
as an effect. Its window is the pedal's page: the same knobs, footswitch, meters and tuner, with
every control a parameter the host can automate and save with the song. A MIDI foot controller
works as it does on the pages, with the Roland FC-300's numbers to start.

The **PhuzzBox app** plays every pedal, one at a time, picked from the menu in its title, straight
from your audio interface at small buffers: a few milliseconds' round trip, against a browser's
15–25. Each pedal also comes as a standalone app of its own.

## Downloading

The downloads above have one archive per system: **every pedal** with the PhuzzBox app, the
**app alone**, and on a pedal's page **that pedal alone**. Each holds every format its system
has, this guide (`INSTALL.md`), the licence and the notices of the code compiled into them.

They are free and unsigned by Apple or Microsoft, so macOS and Windows warn about them until you
allow them, as below. A plugin release follows each update of the site, so a pedal that is new on
the site may come a little later as a plugin: the line under the downloads says which release
they are.

## Mac

Unzip the download, then in Terminal, in the folder it made (type `cd `, drag the folder onto the
window and press Return):

```bash
bash install.sh install
```

It copies each plugin to its folder in `~/Library/Audio/Plug-Ins` (Components for AU, VST3,
CLAP) and the apps to `~/Applications`, clears the quarantine macOS puts on downloads (without
which it blocks them and Logic and MainStage don't list them), and tells Logic and MainStage to
look again. `bash install.sh uninstall` takes them out again, and `bash install.sh list` says
where each one goes.

By hand: copy `.component` to `~/Library/Audio/Plug-Ins/Components`, `.vst3` to
`~/Library/Audio/Plug-Ins/VST3` and `.clap` to `~/Library/Audio/Plug-Ins/CLAP` (**Go ▸ Go to
Folder…** in Finder reaches the hidden `~/Library`), then

```bash
xattr -dr com.apple.quarantine ~/Library/Audio/Plug-Ins/Components ~/Library/Audio/Plug-Ins/VST3 ~/Library/Audio/Plug-Ins/CLAP
killall -9 AudioComponentRegistrar
```

and for an app, `xattr -dr com.apple.quarantine PhuzzBox.app` wherever you put it. In Logic and
MainStage the pedals are under **Audio Units ▸ PhuzzBox**. If one is missing, open **Settings ▸
Plug-in Manager**, select it and choose **Reset & Rescan Selection**. The app asks once for the
microphone: that permission covers your interface's inputs.

## Windows

Unzip the download (right-click it, **Extract All…**). Copy each `.vst3` folder to
`C:\Program Files\Common Files\VST3` and each `.clap` to `C:\Program Files\Common Files\CLAP`
(Windows asks for administrator rights), then rescan the plugins in your host. The apps
(`.exe`) run from anywhere. If SmartScreen stops one ("Windows protected your PC"), choose
**More info ▸ Run anyway**; or before copying, in PowerShell in the folder, clear the
downloaded-from-the-internet mark from everything in it:

```powershell
Get-ChildItem -Recurse | Unblock-File
```

The plugin windows need Microsoft Edge WebView2, which Windows 11 has and Windows 10 gets with Microsoft Edge.

## Linux

Unpack the download (`tar -xzf PhuzzBox-plugins-linux.tar.gz`), then in the folder it made:

```bash
bash install.sh install
```

It copies the VST3s to `~/.vst3`, the CLAPs to `~/.clap` and the apps to `~/.local/bin`.
The plugin windows use GTK 3 and WebKitGTK 4.1, and the apps ALSA or JACK, from your system.
