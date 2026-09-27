#!/usr/bin/env sh
# Shared arrow-key menu primitives for the local launchers.
#
# The caller owns the surrounding lifecycle/traps. This file only owns the
# terminal mode while a menu is active and returns the selected one-based
# option number as interactive_menu_selected_index.

interactive_menu_terminal_state=""
interactive_menu_key=""
interactive_menu_selected_index=1
interactive_menu_timed_out=false

interactive_menu_restore() {
  if [ -n "$interactive_menu_terminal_state" ]; then
    stty "$interactive_menu_terminal_state" </dev/tty 2>/dev/null || true
    interactive_menu_terminal_state=""
  fi
}

interactive_menu_begin() {
  if [ -z "$interactive_menu_terminal_state" ]; then
    interactive_menu_terminal_state=$(stty -g </dev/tty)
  fi
  stty -icanon -echo min 1 time 0 </dev/tty
}

interactive_menu_read_byte() {
  dd if=/dev/tty bs=1 count=1 2>/dev/null | od -An -t x1 | tr -d '[:space:]'
}

interactive_menu_read_key() {
  interactive_menu_key_byte=$(interactive_menu_read_byte)
  case "$interactive_menu_key_byte" in
    '') interactive_menu_key=none ;;
    0a|0d) interactive_menu_key=enter ;;
    1b)
      interactive_menu_sequence_byte=$(interactive_menu_read_byte)
      interactive_menu_direction_byte=$(interactive_menu_read_byte)
      if [ "$interactive_menu_sequence_byte" = "5b" ] && [ "$interactive_menu_direction_byte" = "41" ]; then
        interactive_menu_key=up
      elif [ "$interactive_menu_sequence_byte" = "5b" ] && [ "$interactive_menu_direction_byte" = "42" ]; then
        interactive_menu_key=down
      else
        interactive_menu_key=none
      fi
      ;;
    03|71|51) interactive_menu_key=cancel ;;
    73|53) interactive_menu_key=stop ;;
    72|52) interactive_menu_key=reload_frontend ;;
    62|42) interactive_menu_key=reload_backend ;;
    *) interactive_menu_key=none ;;
  esac
}

interactive_menu_read_timed_key() {
  stty min 0 time 10 </dev/tty
  interactive_menu_read_key
  stty min 1 time 0 </dev/tty
}

interactive_menu_render_options() {
  interactive_menu_render_index=1
  for interactive_menu_option in "$@"; do
    if [ "$interactive_menu_render_index" -eq "$interactive_menu_index" ]; then
      printf '  > %s\n' "$interactive_menu_option" >&2
    else
      printf '    %s\n' "$interactive_menu_option" >&2
    fi
    interactive_menu_render_index=$((interactive_menu_render_index + 1))
  done
}

interactive_menu_select() {
  interactive_menu_title=$1
  shift
  interactive_menu_count=$#
  interactive_menu_index=1
  interactive_menu_begin

  while :; do
    printf '\033[2J\033[H' >&2
    printf '%s (↑/↓, Enter):\n' "$interactive_menu_title" >&2
    interactive_menu_render_options "$@"
    echo "  q/Ctrl+C: cancel" >&2

    interactive_menu_read_key
    case "$interactive_menu_key" in
      up)
        if [ "$interactive_menu_index" -eq 1 ]; then interactive_menu_index=$interactive_menu_count; else interactive_menu_index=$((interactive_menu_index - 1)); fi
        ;;
      down)
        if [ "$interactive_menu_index" -eq "$interactive_menu_count" ]; then interactive_menu_index=1; else interactive_menu_index=$((interactive_menu_index + 1)); fi
        ;;
      enter) break ;;
      cancel)
        interactive_menu_restore
        return 130
        ;;
    esac
  done

  interactive_menu_restore
  interactive_menu_selected_index=$interactive_menu_index
}

interactive_menu_select_timed() {
  interactive_menu_title=$1
  interactive_menu_timeout_seconds=$2
  shift 2
  interactive_menu_count=$#
  interactive_menu_index=1
  interactive_menu_timed_out=false
  interactive_menu_confirmed=false
  interactive_menu_begin

  while [ "$interactive_menu_timeout_seconds" -gt 0 ]; do
    printf '\033[2J\033[H' >&2
    printf '%s — timeout: %ss; default: first option\n' "$interactive_menu_title" "$interactive_menu_timeout_seconds" >&2
    interactive_menu_render_options "$@"
    echo "  q/Ctrl+C: cancel" >&2

    interactive_menu_read_timed_key
    case "$interactive_menu_key" in
      up)
        if [ "$interactive_menu_index" -eq 1 ]; then interactive_menu_index=$interactive_menu_count; else interactive_menu_index=$((interactive_menu_index - 1)); fi
        ;;
      down)
        if [ "$interactive_menu_index" -eq "$interactive_menu_count" ]; then interactive_menu_index=1; else interactive_menu_index=$((interactive_menu_index + 1)); fi
        ;;
      enter)
        interactive_menu_confirmed=true
        break
        ;;
      cancel|stop)
        interactive_menu_restore
        return 130
        ;;
      none)
        interactive_menu_timeout_seconds=$((interactive_menu_timeout_seconds - 1))
        ;;
    esac
  done

  interactive_menu_restore
  if [ "$interactive_menu_confirmed" != "true" ]; then
    interactive_menu_index=1
    interactive_menu_timed_out=true
  fi
  interactive_menu_selected_index=$interactive_menu_index
}
