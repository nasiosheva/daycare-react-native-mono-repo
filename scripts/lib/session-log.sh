#!/usr/bin/env sh
# Shared session-log exporter for the run-*.sh launchers.
#
# start_session_log <repository_root> <label>
#   repository_root: absolute path to the repo root; run-logs/ is created there
#   label:           included in the log filename (device model, "web-local",
#                     "backend", ...)
#
# Relays this process's remaining stdout/stderr to the terminal exactly as
# before, while also appending everything into a timestamped file under
# run-logs/. Call it once this script's own interactive prompts are done —
# they read from /dev/tty and print to fd 2, so they are unaffected either
# way, but a prompt owned by a script called afterwards (a bare `read -r -p
# "...: "` on fd 1/2) must still reach the terminal before the user has typed
# anything, so the relay is byte-driven (tee), never line-buffered.
#
# Implemented with a named pipe rather than bash's `exec > >(...)` process
# substitution, since these launchers target POSIX sh (dash on macOS uses
# /bin/sh, which lacks that syntax).
start_session_log() {
  session_log_repository_root=$1
  session_log_label=$2

  session_log_dir="$session_log_repository_root/run-logs"
  mkdir -p "$session_log_dir"
  session_log_file="$session_log_dir/$session_log_label-$(date '+%Y%m%d-%H%M%S').txt"
  echo "Session log will be exported to $session_log_file" >&2

  session_log_fifo=$(mktemp -u "${TMPDIR:-/tmp}/session-log.XXXXXX")
  mkfifo "$session_log_fifo"
  tee -a "$session_log_file" <"$session_log_fifo" &

  # Opening the FIFO for writing blocks until the tee above has opened its
  # read end, so once this returns both ends are connected and the path's
  # directory entry can be removed — the open file descriptors on both sides
  # stay valid until this process exits (or exec replaces it).
  exec >"$session_log_fifo" 2>&1
  rm -f "$session_log_fifo"
}
