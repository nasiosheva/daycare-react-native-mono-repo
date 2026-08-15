#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
ios_dir="$repository_root/apps/mobile/ios"

if [ ! -d "$ios_dir" ]; then
  echo "No apps/mobile/ios directory found (run expo prebuild first); nothing to clean." >&2
  exit 0
fi

for dir in "$ios_dir/build" "$ios_dir/Pods"; do
  if [ -d "$dir" ]; then
    echo "Removing $dir" >&2
    rm -rf "$dir"
  fi
done

xcodeproj=$(find "$ios_dir" -maxdepth 1 -name '*.xcodeproj' | head -n 1)
if [ -n "$xcodeproj" ]; then
  project_name=$(basename "$xcodeproj" .xcodeproj)
  derived_data_dir="$HOME/Library/Developer/Xcode/DerivedData"
  if [ -d "$derived_data_dir" ]; then
    for match in "$derived_data_dir/$project_name"-*; do
      if [ -d "$match" ]; then
        echo "Removing $match" >&2
        rm -rf "$match"
      fi
    done
  fi
fi

echo "iOS build/cache cleanup complete." >&2
