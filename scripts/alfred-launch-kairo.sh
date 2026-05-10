#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/Users/aamin/dev/projects/kairo"
PORT="${KAIRO_PORT:-3929}"
URL="http://localhost:${PORT}"
LOG_DIR="${HOME}/Library/Logs/kairo"
LOG_FILE="${LOG_DIR}/next-dev.log"
PID_FILE="/tmp/kairo-next-dev-${PORT}.pid"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

mkdir -p "${LOG_DIR}"
cd "${APP_DIR}"

notify() {
  /usr/bin/osascript -e "display notification \"$1\" with title \"Kairo\"" >/dev/null 2>&1 || true
}

is_healthy() {
  /usr/bin/curl -fsS "${URL}" >/dev/null 2>&1
}

pid_alive() {
  [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" >/dev/null 2>&1
}

stop_stale_server() {
  if pid_alive; then
    kill "$(cat "${PID_FILE}")" >/dev/null 2>&1 || true
    sleep 1
  fi

  /usr/sbin/lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | while IFS= read -r pid; do
    kill "${pid}" >/dev/null 2>&1 || true
  done

  rm -f "${PID_FILE}"
}

start_server() {
  if ! command -v npm >/dev/null 2>&1; then
    notify "npm not found. Install Node or fix PATH."
    /usr/bin/open -a Terminal "${APP_DIR}"
    exit 1
  fi

  if [[ ! -d node_modules ]]; then
    notify "Run npm install in Kairo first."
    /usr/bin/open -a Terminal "${APP_DIR}"
    exit 1
  fi

  notify "Starting Kairo..."
  nohup npm run dev -- --port "${PORT}" >>"${LOG_FILE}" 2>&1 &
  echo $! > "${PID_FILE}"
}

if is_healthy; then
  /usr/bin/open "${URL}"
  exit 0
fi

stop_stale_server
start_server

for _ in {1..60}; do
  if is_healthy; then
    /usr/bin/open "${URL}"
    exit 0
  fi
  sleep 1
done

notify "Kairo did not start. Opening logs."
/usr/bin/open -a Terminal "${LOG_FILE}"
exit 1
