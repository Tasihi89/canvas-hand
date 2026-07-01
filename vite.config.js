import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// 画布数据存哪：默认存进固定目录 ~/.canvas-hand/canvas（一个画布、反复用，对小白最省心，
// 不跟 codex 对话的项目跑）。仍可用环境变量覆盖到别处。
import os from "node:os";
const DEFAULT_CANVAS_DIR = path.join(os.homedir(), ".canvas-hand", "canvas");
const canvasDir = path.resolve(
  process.env.CANVAS_HAND_CANVAS_DIR ??
    (process.env.CANVAS_HAND_PROJECT_DIR
      ? path.join(process.env.CANVAS_HAND_PROJECT_DIR, "canvas")
      : DEFAULT_CANVAS_DIR)
);
const CANVAS_FILE = path.join(canvasDir, "canvas.json");
// 带箭头标记的导出图，固定存这张，每轮覆盖（AI 处理完就不要了，不留历史）
const MARKED_PNG = path.join(canvasDir, "marked.png");

// 这就是“教服务员新活”的地方：一个 Vite 插件，给服务员加“耳朵”
function canvasStoragePlugin() {
  return {
    name: "canvas-storage",
    configureServer(server) {
      // 给服务员加一只耳朵，专门听所有 /api/* 的请求
      server.middlewares.use((req, res, next) => {
        // —— 活儿①：保存。听到 “POST /api/save” 就干 ——
        if (req.method === "POST" && req.url === "/api/save") {
          let body = "";
          req.on("data", (chunk) => (body += chunk)); // 把浏览器递来的内容一点点收齐
          req.on("end", () => {
            fs.mkdirSync(path.dirname(CANVAS_FILE), { recursive: true }); // 确保 canvas/ 文件夹在
            fs.writeFileSync(CANVAS_FILE, body); // 把收到的内容写进磁盘文件
            res.statusCode = 200;
            res.end("已存盘"); // 回浏览器一句“搞定”
          });
          return; // 这活接了，不往下传
        }

        // —— 活儿③：接“带箭头标记的 PNG”。听到 “POST /api/save-png” 就干 ——
        // 跟上面 /api/save 几乎一样，唯一不同：收到的是 base64 文字，写盘前要转回二进制
        if (req.method === "POST" && req.url === "/api/save-png") {
          let body = "";
          req.on("data", (chunk) => (body += chunk)); // 收齐前端递来的 base64 文字
          req.on("end", () => {
            // 前端给的是 data-URL（"data:image/png;base64,xxxx"），逗号后面才是真 base64
            const base64 = body.split(",").pop();
            fs.mkdirSync(path.dirname(MARKED_PNG), { recursive: true });
            fs.writeFileSync(MARKED_PNG, Buffer.from(base64, "base64")); // base64 文字 → 二进制字节 → 写成 .png
            res.statusCode = 200;
            res.end("已存图");
          });
          return;
        }

        // —— 活儿②：读取。听到 “GET /api/load” 就干（你拍的决策：GET=前端来取东西）——
        if (req.method === "GET" && req.url === "/api/load") {
          // 首次没有 canvas.json（干净环境/空画布）→ 回一个空对象，别崩。
          // 前端收到空对象会跳过加载、用 tldraw 默认空画布；MCP 收到会兜底成空 store。
          if (!fs.existsSync(CANVAS_FILE)) {
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end("{}");
            return;
          }
          const data = fs.readFileSync(CANVAS_FILE, "utf-8"); // 从磁盘把画读出来
          res.statusCode = 200;
          res.end(data); // 把读到的内容原样回给前端
          return;
        }

        // —— 活儿④：把标注截图(marked.png)读成 base64 回给调用方 ——
        // 给 MCP 用：MCP 不再自己开文件，改成来这儿要（走 HTTP，碰文件的只剩后端一只手）
        if (req.method === "GET" && req.url === "/api/marked") {
          if (!fs.existsSync(MARKED_PNG)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "marked.png 不存在" }));
            return;
          }
          const base64 = fs.readFileSync(MARKED_PNG).toString("base64");
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ base64 }));
          return;
        }

        next(); // 不是我管的请求，交给下一个处理（比如正常递网页）
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), canvasStoragePlugin()], // 把这项新活挂到服务员身上
  server: {
    host: "127.0.0.1",
    port: Number(process.env.CANVAS_HAND_PORT ?? 8000),
  },
});
