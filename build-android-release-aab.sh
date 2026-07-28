#!/usr/bin/env sh
exec "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/scripts/build-android-release.sh" aab
