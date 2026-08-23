#!/usr/bin/env sh
# Interactive native build/cache cleanup, replacing the old
# clean-android-build.sh / clean-ios-build.sh pair. Asks whether to clean
# Android only, iOS only, or both.
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
android_dir="$repository_root/apps/mobile/android"
ios_dir="$repository_root/apps/mobile/ios"

prompt_target() {
  echo "Select what to clean:" >&2
  echo "  1) Android only" >&2
  echo "  2) iOS only" >&2
  echo "  3) Both" >&2
  printf 'Target [1-3]: ' >&2
  read -r selection </dev/tty
  case "$selection" in
    1) should_clean_android=true; should_clean_ios=false ;;
    2) should_clean_android=false; should_clean_ios=true ;;
    3) should_clean_android=true; should_clean_ios=true ;;
    *)
      echo "Invalid selection: $selection" >&2
      exit 1
      ;;
  esac
}

clean_android() {
  if [ ! -d "$android_dir" ]; then
    echo "No apps/mobile/android directory found (run expo prebuild first); nothing to clean." >&2
    return
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
}

clean_ios() {
  if [ ! -d "$ios_dir" ]; then
    echo "No apps/mobile/ios directory found (run expo prebuild first); nothing to clean." >&2
    return
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
}

prompt_target

[ "$should_clean_android" = "true" ] && clean_android
[ "$should_clean_ios" = "true" ] && clean_ios
