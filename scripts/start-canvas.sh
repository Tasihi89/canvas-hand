#!/usr/bin/env bash
# 启动画布服务（vite）。由 open-canvas skill 拉起。
# 画布数据存进固定目录 ~/.canvas-hand/canvas（一个画布反复用，对小白最省心）。
set -euo pipefail

# 自定位插件根目录（代码和 node_modules 都在这）
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 端口默认 8000（MCP 也默认连 8000，必须一致）
PORT="${CANVAS_HAND_PORT:-8000}"

# 画布数据目录：默认 ~/.canvas-hand/canvas，可用环境变量覆盖
CANVAS_DIR="${CANVAS_HAND_CANVAS_DIR:-$HOME/.canvas-hand/canvas}"
mkdir -p "$CANVAS_DIR"

# 导出给 vite.config.js 读
export CANVAS_HAND_CANVAS_DIR="$CANVAS_DIR"
export CANVAS_HAND_PORT="$PORT"

# 回插件目录跑 vite（用插件自己的 node_modules）
cd "$ROOT_DIR"
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  npm install
fi

echo "Canvas Hand: http://127.0.0.1:${PORT}"
echo "Canvas data: ${CANVAS_DIR}/canvas.json"
exec npm run dev -- --host 127.0.0.1 --port "$PORT"
