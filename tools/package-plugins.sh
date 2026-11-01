#!/usr/bin/env bash
# package-plugins.sh — the archives a plugin release ships (the release-plugins workflow; names in
# shared/plugins.js), from what one system built: PhuzzBox-plugins-<system> with every pedal that
# has plugins and the PhuzzBox app, PhuzzBox-app-<system> with the app alone, and
# PhuzzBox-<id>-<system> with each pedal alone, every format its system has (AU, VST3, CLAP and
# the standalone app). Each also has plugins/README.md (as INSTALL.md), the LICENSE (as
# LICENSE.txt), THIRD-PARTY-NOTICES.md, and on macOS and Linux native/install.sh. The archives
# keep the bundles' executable bits and macOS's signatures. Run from the repository's root after
# building:
#
#   tools/package-plugins.sh <linux|macos|windows>     writes dist/
set -euo pipefail
preset=$1
build=native/build/$preset
plugins=$build/plugins
root=$build/pkg
rm -rf "$root" dist
mkdir -p "$root" dist

# Every bundle wherever the generator put it (Visual Studio nests them in Release/ folders), and
# Linux's standalones, which have no extension.
bundles() {
  find "$plugins" \( -name '*.clap' -o -name '*.vst3' -o -name '*.component' -o -name '*.app' -o -name '*.exe' \) -prune -print
  [ "$preset" != linux ] || find "$plugins" -mindepth 1 -maxdepth 1 -type f ! -name '*.*' -perm -u+x
}
# the PhuzzBox app
app() {
  case "$preset" in
    macos) echo "$build/app/PhuzzBox.app" ;;
    windows) find "$build/app" -name PhuzzBox.exe | head -1 ;;
    linux) echo "$build/app/PhuzzBox" ;;
  esac
}

# pack <archive name without the system> <folder inside it> <with the app: 0|1> <pedal name>…
pack() {
  local out=$1 folder=$2 with_app=$3; shift 3
  local dir="$root/$out/$folder"
  mkdir -p "$dir"
  for name in "$@"; do
    local n=0
    while IFS= read -r p; do
      b=$(basename "$p")
      if [ "${b%.*}" = "$name" ] || [ "$b" = "$name" ]; then cp -R "$p" "$dir"/; n=$((n + 1)); fi
    done < <(bundles)
    [ "$n" -gt 0 ] || { echo "no plugins built for $name in $plugins" >&2; exit 1; }
  done
  if [ "$with_app" = 1 ]; then
    a=$(app)
    [ -n "$a" ] && [ -e "$a" ] || { echo "the PhuzzBox app isn't built in $build/app" >&2; exit 1; }
    cp -R "$a" "$dir"/
  fi
  cp plugins/README.md "$dir/INSTALL.md"
  cp LICENSE "$dir/LICENSE.txt"
  cp THIRD-PARTY-NOTICES.md "$dir"/
  [ "$preset" = windows ] || cp native/install.sh "$dir"/
  case "$preset" in
    macos) ditto -c -k --sequesterRsrc --keepParent "$dir" "dist/$out-macos.zip" ;;
    windows) (cd "$root/$out" && 7z a -tzip -bso0 "$(cd ../../../../.. && pwd)/dist/$out-windows.zip" "$folder") ;;
    linux) tar -czf "dist/$out-linux.tar.gz" -C "$root/$out" "$folder" ;;
  esac
}

names=()
while IFS=$'\t' read -r id name; do
  name=${name%$'\r'}
  names+=("$name")
  pack "PhuzzBox-$id" "$name" 0 "$name"
done < <(node tools/plugin-release.mjs --plugins)
[ "${#names[@]}" -gt 0 ] || { echo "tools/plugin-release.mjs --plugins listed no pedals" >&2; exit 1; }
pack PhuzzBox-plugins "PhuzzBox plugins" 1 "${names[@]}"
pack PhuzzBox-app "PhuzzBox app" 1
ls -l dist
