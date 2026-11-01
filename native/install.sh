#!/usr/bin/env bash
# install.sh — put the PhuzzBox plugins and apps in this folder where hosts look for them, on a
# Mac or on Linux (plugins/README.md). Nothing needs sudo.
#
#   bash install.sh install     copy them in place (on a Mac, also clear the download quarantine
#                               and tell Logic and MainStage to look again)
#   bash install.sh uninstall   remove what install put there
#   bash install.sh list        say where each one goes, and do nothing
set -euo pipefail
cd "$(dirname "$0")"
case "$(uname -s)" in
  Darwin) mac=1; lib="$HOME/Library/Audio/Plug-Ins" ;;
  Linux) mac=0 ;;
  *) echo "On Windows, follow INSTALL.md instead." >&2; exit 1 ;;
esac

# dest <bundle>: the folder it belongs in, or nothing
dest() {
  case "$1" in
    *.component) echo "$lib/Components" ;;
    *.vst3) if [ "$mac" = 1 ]; then echo "$lib/VST3"; else echo "$HOME/.vst3"; fi ;;
    *.clap) if [ "$mac" = 1 ]; then echo "$lib/CLAP"; else echo "$HOME/.clap"; fi ;;
    *.app) echo "$HOME/Applications" ;;
    *.md|*.txt|*.sh) ;;
    *) if [ "$mac" = 0 ] && [ -f "$1" ] && [ -x "$1" ]; then echo "$HOME/.local/bin"; fi ;;
  esac
}

action=${1:-help}
n=0
for b in *; do
  d=$(dest "$b")
  [ -n "$d" ] || continue
  n=$((n + 1))
  case "$action" in
    list) echo "$b -> $d/" ;;
    install)
      mkdir -p "$d"
      rm -rf "${d:?}/$b"
      cp -R "$b" "$d/"
      [ "$mac" = 0 ] || xattr -dr com.apple.quarantine "$d/$b" 2>/dev/null || true
      echo "installed $d/$b" ;;
    uninstall) if [ -e "$d/$b" ]; then rm -rf "${d:?}/$b"; echo "removed $d/$b"; fi ;;
    *) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  esac
done
[ "$n" -gt 0 ] || { echo "No plugins in this folder." >&2; exit 1; }
# Logic, MainStage and GarageBand read the Audio Units' list once; this makes them read it again
if [ "$mac" = 1 ] && [ "$action" != list ]; then killall -9 AudioComponentRegistrar 2>/dev/null || true; fi
