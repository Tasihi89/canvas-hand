#!/usr/bin/env bash
# 启动 MCP server（canvas-hand 的手）。codex 按 .mcp.json 拉起这个脚本。
set -euo pipefail

# 自定位插件根目录：无论装在哪，都从脚本自身位置算出来，不写死路径
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 首次运行若缺依赖，自动装一次（用 image-size 当探针——它是 add-picture 的真实依赖）
if [ ! -d node_modules ] || [ ! -d node_modules/image-size ]; then
  npm install
fi

exec node ./mcp/hello-server.mjs
