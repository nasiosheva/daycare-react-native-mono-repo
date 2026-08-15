#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
android_dir="$repository_root/apps/mobile/android"

if [ ! -d "$android_dir" ]; then
  echo "No apps/mobile/android directory found (run expo prebuild first); nothing to clean." >&2
  exit 0
fi

if [ -x "$android_dir/gradlew" ]; then
  echo "Running ./gradlew clean in apps/mobile/android..." >&2
  (cd "$android_dir" && ./gradlew clean)
else
  echo "gradlew not found or not executable in apps/mobile/android; skipping gradlew clean." >&2
fi

for dir in "$android_dir/build" "$android_dir/app/build" "$android_dir/app/.cxx" "$android_dir/.gradle" "$android_dir/.kotlin"; do
  if [ -d "$dir" ]; then
    echo "Removing $dir" >&2
    rm -rf "$dir"
  fi
done

echo "Android build/cache cleanup complete." >&2
