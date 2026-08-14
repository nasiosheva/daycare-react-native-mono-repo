#!/usr/bin/env sh
exec "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/build-android-release.sh" apk
