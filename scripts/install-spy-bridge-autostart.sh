#!/bin/bash
# Instala arranque automatico da ponte SPY (LaunchAgent macOS).
set -e
PROJECT_DIR="${SPY_MAC_PROJECT_DIR:-/Volumes/Remote Nrl /Cursor/Projetos/TaskForce 2026/ECOOM TaskForce}"
BIN_DIR="$HOME/bin"
LAUNCHER="$BIN_DIR/ecom-spy-bridge-launch.sh"
PLIST="$HOME/Library/LaunchAgents/com.ecoomtaskforce.spy-bridge.plist"
LOG="$HOME/.ecom-spy-ponte.log"
PORT="${SPY_MOBILE_LOCAL_PORT:-9780}"
NODE_BIN="$(command -v node || true)"

if [ -z "$NODE_BIN" ]; then
  echo "node nao encontrado no PATH"
  exit 1
fi

mkdir -p "$BIN_DIR" "$HOME/Library/LaunchAgents"

cat > "$LAUNCHER" <<'LAUNCH_EOF'
#!/bin/bash
set -e
PROJECT_DIR="__PROJECT_DIR__"
NODE_BIN="__NODE_BIN__"
LOG="$HOME/.ecom-spy-ponte.log"
PORT="__PORT__"

for i in $(seq 1 60); do
  if [ -f "$PROJECT_DIR/scripts/spy-mobile-bridge-local.js" ]; then
    break
  fi
  sleep 5
done

if [ ! -f "$PROJECT_DIR/scripts/spy-mobile-bridge-local.js" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) projecto SPY nao encontrado" >> "$LOG"
  exit 1
fi

if curl -s --max-time 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  exit 0
fi

cd "$PROJECT_DIR" || exit 1
exec "$NODE_BIN" scripts/spy-mobile-bridge-local.js >> "$LOG" 2>&1
LAUNCH_EOF

sed -i '' "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$LAUNCHER"
sed -i '' "s|__NODE_BIN__|$NODE_BIN|g" "$LAUNCHER"
sed -i '' "s|__PORT__|$PORT|g" "$LAUNCHER"
chmod +x "$LAUNCHER"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ecoomtaskforce.spy-bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>$LAUNCHER</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/com.ecoomtaskforce.spy-bridge" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/com.ecoomtaskforce.spy-bridge"

echo "Ponte SPY - arranque automatico instalado"
echo "Launcher: $LAUNCHER"
echo "Log: $LOG"
