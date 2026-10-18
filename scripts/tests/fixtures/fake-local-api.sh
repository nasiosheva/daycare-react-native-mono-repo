#!/usr/bin/env sh
# Mories Deo Hutapea,S.E.,S.Kom
printf 'started\n' >>"$LOCAL_API_TEST_STARTS"
printf '%s\n' "$$" >"$LOCAL_API_TEST_PID"
sleep 2
touch "$LOCAL_API_TEST_READY"
exec sleep 60
