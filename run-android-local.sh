#!/usr/bin/env sh
exec "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/scripts/run-mobile.sh" android local
