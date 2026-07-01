// 最小 MCP server —— M5.1：只验证「AI 能不能喊到这副手」
// 一个傻工具：打个招呼，回一句固定话。

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import os from "os";
import { imageSize } from "image-size"; // 解出图片真实宽高，别把相框写死成正方形

// 画布服务地址：MCP 不再自己开文件，改成跟画布后端（vite）要数据。
// 这样"碰文件的手"只剩后端一只，MCP 和前端读写同一份 canvas.json，打包成 plugin 后两进程不会指向不同目录。
const CANVAS_URL = (process.env.CANVAS_HAND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// 调试日志：写到用户家目录下的固定位置（插件缓存目录是只读语义、升级即丢，不能写那）
const LOG_FILE = path.join(os.homedir(), ".canvas-hand", "tool-calls.log");
function logCall(name, extra = "") {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${name} ${extra}\n`);
  } catch {
    // 日志写不了不影响主流程
  }
}

// —— HTTP 封装：MCP 跟画布后端打交道的两只手 ——
async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (e) {
    throw new Error(`连不上画布服务（${CANVAS_URL}）——请先打开画布把服务起起来。原始错误：${e.message}`);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

// 读整份画布（GET /api/load）。返回带 document.store 的合法结构。
// 首次空画布时后端回 {}（没有 tldraw schema）——此时若直接造假空档会缺 schema、存回去导致前端白屏，
// 所以抛错让调用方提示用户"先打开画布"（开画布时前端会存一份带 schema 的合法空档，之后就正常了）。
async function loadCanvas() {
  const data = await fetchJson(`${CANVAS_URL}/api/load`);
  if (!data || !data.document || !data.document.store) {
    throw new Error("画布还没初始化——请先在 codex 里说“打开我的画布”，把画布开一次（这会建好画布存档），再重试。");
  }
  return data;
}

// 写回整份画布（POST /api/save），body 就是整份 JSON 文本
async function saveCanvas(data) {
  const response = await fetch(`${CANVAS_URL}/api/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data, null, 2),
  }).catch((e) => {
    throw new Error(`连不上画布服务（${CANVAS_URL}）——请先打开画布。原始错误：${e.message}`);
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`存盘失败 ${response.status}: ${t.slice(0, 300)}`);
  }
}

// 1) 开一个 server，报上自己的名号
const server = new McpServer({
  name: "canvas-hand",
  version: "0.0.1",
});

// 2) 摆出一个工具（报菜单 + 接订单都在这）
server.registerTool(
  "say_hello",
  {
    title: "打个招呼",
    description: "喊我一声，我回一句固定的话。用来验证连线。",
    inputSchema: {}, // 不需要传参
  },
  async () => {
    // 接到订单后干的活：回固定话
    return {
      content: [{ type: "text", text: "你好，我是画布的手" }],
    };
  }
);

// 第二个工具：真去读画布文件，数出有几个 shape、各是啥种类
server.registerTool(
  "count-shapes",
  {
    title: "数画布上的东西",
    description: "读画布存盘文件，回答画布上有几个东西、各是什么种类。",
    inputSchema: {},
  },
  async () => {
    // 1) 跟后端要整份画布（不再自己开文件）
    const data = await loadCanvas();
    const store = data.document.store;

    // 2) 只挑 typeName === "shape" 的（其余 user/page/document 是杂物）
    const shapes = Object.values(store).filter((it) => it.typeName === "shape");

    // 3) 取每个 shape 的 type（draw/geo/text...），拼成人话
    const types = shapes.map((s) => s.type);
    const text = `画布上有 ${shapes.length} 个东西：${types.join(", ")}`;

    return { content: [{ type: "text", text }] };
  }
);

// 第三个工具：往画布塞一张图片（AI 的手第一次"写"画布）
// 两件套：asset（照片本体）+ image shape（相框，指向照片）
server.registerTool(
  "add-picture",
  {
    title: "往画布加一张图片",
    description: "把一个本地图片文件放到画布上（写进存盘文件）。",
    inputSchema: {
      filePath: z.string().describe("本地图片文件的绝对路径"),
    },
  },
  async ({ filePath }) => {
    logCall("add-picture", "filePath=" + filePath);
    try {
      // 1) 读图片文件，编码成 data URL（把照片嚼成文本）
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = ext === "jpg" ? "jpeg" : ext; // jpg 的 mime 是 image/jpeg
      const dataUrl = `data:image/${mime};base64,${buf.toString("base64")}`;

      // 1.5) 解出图片真实宽高（别再写死 400×400 把比例压扁）。
      //      太大就等比缩到最长边 600，画布上不至于占满屏，比例不变。
      const dim = imageSize(buf);
      const MAX = 600;
      const scale = Math.min(1, MAX / Math.max(dim.width, dim.height));
      const w = Math.round(dim.width * scale);
      const h = Math.round(dim.height * scale);

      // 2) 跟后端要画布（add-picture 读的源图 filePath 仍用 fs，那是本地图文件、不是画布数据）
      const data = await loadCanvas();
      const store = data.document.store;

      // 3) 造 asset 记录（照片入库）
      const assetId = "asset:ai-pic-" + Date.now();
      store[assetId] = {
        id: assetId,
        typeName: "asset",
        type: "image",
        props: {
          name: path.basename(filePath),
          src: dataUrl,        // 照片本体就在这
          w,
          h,
          mimeType: `image/${mime}`,
          isAnimated: false,
        },
        meta: {},
      };

      // 4) 算新图该放哪（A 方案：放在画布上最靠右那张图的右边）
      //    先睁眼扫一遍画布上已有的 image，再据现状决定位置——不写死、不机械递增
      const GAP = 300;           // 两张图之间留点缝（留宽点，图周围要做标注）
      const START_X = 200;       // 空画布时的兜底落脚点
      const START_Y = 200;
      let newX, newY;

      const existingImages = Object.values(store).filter(
        (it) => it.typeName === "shape" && it.type === "image"
      );

      if (existingImages.length === 0) {
        // 一张图都没有 → 放固定起点，别去找不存在的"最右"
        newX = START_X;
        newY = START_Y;
      } else {
        // 找出右边缘最靠右的那张（右边缘 = 它的 x + 它的宽 w）
        let maxRight = -Infinity;
        let rightmost = null;
        for (const img of existingImages) {
          const right = img.x + img.props.w;
          if (right > maxRight) {
            maxRight = right;
            rightmost = img;
          }
        }
        newX = maxRight + GAP;     // 新图放最右那张的右边 + 缝
        newY = rightmost.y;        // 和它顶部对齐，排成一行
      }

      // 5) 造 image shape 记录（相框，指向上面那张照片）
      const shapeId = "shape:ai-pic-" + Date.now();
      store[shapeId] = {
        x: newX,
        y: newY,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        id: shapeId,
        type: "image",
        props: {
          w,
          h,
          assetId,             // 相框指向哪张照片
          playing: true,
          url: "",
          crop: null,
          flipX: false,
          flipY: false,
          altText: "",
        },
        parentId: "page:page",
        index: "a99",
        typeName: "shape",
      };

      // 5) 写回画布（POST 给后端，不再自己写文件）
      await saveCanvas(data);

      logCall("add-picture", "成功写入");
      return { content: [{ type: "text", text: "已往画布加了一张图片" }] };
    } catch (e) {
      logCall("add-picture", "报错: " + e.message);
      return { content: [{ type: "text", text: "出错了：" + e.message }] };
    }
  }
);

// 第四个工具：让 AI 真正"看见"画布上的一张图（AI 的眼睛）
// 收一个相框(shape)的 id → 顺藤找到照片(asset) → 把它的 base64 用 image 形式递回
server.registerTool(
  "look-at-picture",
  {
    title: "看画布上的一张图",
    description: "给一个图片相框(shape)的 id，我把那张图本身递给你看。",
    inputSchema: {
      shapeId: z.string().describe("画布上图片相框的 shape id，形如 shape:xxx"),
    },
  },
  async ({ shapeId }) => {
    logCall("look-at-picture", "shapeId=" + shapeId);

    // 1) 跟后端要画布
    const data = await loadCanvas();
    const store = data.document.store;

    // 2) 找到那个相框；找不到 / 不是图片 → 回一句人话（决策 A）
    const shape = store[shapeId];
    if (!shape) {
      logCall("look-at-picture", "没找到这个 shape");
      return { content: [{ type: "text", text: `没找到 id 为 ${shapeId} 的形状。` }] };
    }
    if (shape.type !== "image") {
      logCall("look-at-picture", "不是图片，是 " + shape.type);
      return { content: [{ type: "text", text: `${shapeId} 不是图片，是「${shape.type}」。` }] };
    }

    // 3) 顺着相框找到照片本体(asset)，取出 base64
    const asset = store[shape.props.assetId];
    if (!asset || !asset.props || !asset.props.src) {
      logCall("look-at-picture", "相框找到了但照片丢了");
      return { content: [{ type: "text", text: `找到了相框，但它指向的照片不见了。` }] };
    }

    // 4) src 长这样：data:image/jpeg;base64,/9j/4AA...
    //    脱掉前面那截"衣服标签"，把 mimeType 和纯 base64 正文分开
    const src = asset.props.src;
    const m = src.match(/^data:(image\/[^;]+);base64,(.+)$/s);
    if (!m) {
      logCall("look-at-picture", "src 不是 data url，没法递");
      return { content: [{ type: "text", text: `这张图的存法我暂时认不出来，递不了。` }] };
    }
    const mimeType = m[1]; // image/jpeg
    const base64 = m[2];   // 纯正文，不带前缀

    // 5) 用 image 形式把照片递回去 —— AI 这下真看见了
    logCall("look-at-picture", "递出图片 " + mimeType);
    return {
      content: [
        { type: "text", text: `这是 ${shapeId} 那张图：` },
        { type: "image", data: base64, mimeType },
      ],
    };
  }
);

// 看标记图：直接读磁盘上固定的 marked.png（前端导出的"图+箭头+指令文字"那张），递给 AI 看。
// 和 look-at-picture 的区别：marked.png 不在画布 store 里、没有 shapeId，所以跳过 store、直接读文件。
server.registerTool(
  "look-at-marked-image",
  {
    title: "看带标注的截图",
    description: "把前端刚导出的『图+箭头+修改指令』标注截图(marked.png)递给你看，你据此知道要改这张图的哪个部位、改成什么。",
    inputSchema: {}, // 不收参数：路径固定就是 canvas/marked.png
  },
  async () => {
    logCall("look-at-marked-image", "读 marked.png");
    let res;
    try {
      res = await fetchJson(`${CANVAS_URL}/api/marked`);
    } catch (e) {
      // 404 = 还没标注图；其它 = 服务问题
      if (String(e.message).startsWith("404")) {
        return { content: [{ type: "text", text: "还没有标注截图（marked.png 不存在）。请先在画布上用「改图指令」笔画箭头标注。" }] };
      }
      return { content: [{ type: "text", text: e.message }] };
    }
    return {
      content: [
        { type: "text", text: "这是带标注的截图（图+箭头+指令文字）：" },
        { type: "image", data: res.base64, mimeType: "image/png" },
      ],
    };
  }
);

// 第五个工具：读画布上所有"改图指令"箭头，算每个箭头尖端戳中哪张图，配上箭头里的文字
// 这是 M6.3 闭环的眼睛：AI 靠它知道「哪张图要改、改成什么」
server.registerTool(
  "read-annotations",
  {
    title: "读画布上的改图指令",
    description:
      "扫描画布上所有箭头，算出每个箭头尖端戳中了哪张图，并读出箭头上的文字指令。返回 [{imageShapeId, instruction}] 列表，供你按指令重画。",
    inputSchema: {},
  },
  async () => {
    logCall("read-annotations");

    const data = await loadCanvas();
    const shapes = Object.values(data.document.store).filter(
      (it) => it.typeName === "shape"
    );
    const arrows = shapes.filter((s) => s.type === "arrow");
    const images = shapes.filter((s) => s.type === "image");

    // 只认"最新那张图"上的箭头（A′ 零写入去重）：
    // add-picture 起名用 ai-pic-{毫秒时间戳}，从 id 末尾抠数字，最大=最新。
    // 抠不出数字的图（手动拖入等）当 0，永远排最老、不抢"最新"。
    const stamp = (img) => Number(String(img.id).match(/(\d+)$/)?.[1] ?? 0);
    const newest = images.reduce(
      (best, img) => (stamp(img) > stamp(best) ? img : best),
      images[0]
    );

    // 把 richText（ProseMirror doc）里所有 text 节点的文字抠出来拼成一句
    const readText = (node) => {
      if (!node) return "";
      if (node.text) return node.text;
      return (node.content || []).map(readText).join("");
    };

    const results = [];
    for (const arrow of arrows) {
      const text = readText(arrow.props.richText).trim();
      if (!text) continue; // 没文字 = 不是改图指令，跳过

      // 尖端绝对坐标 = 箭头原点 + end 偏移
      const tipX = arrow.x + arrow.props.end.x;
      const tipY = arrow.y + arrow.props.end.y;

      // 只收尖端落在【最新图】相框矩形里的箭头；戳旧图的一律跳过
      if (
        !newest ||
        tipX < newest.x ||
        tipX > newest.x + newest.props.w ||
        tipY < newest.y ||
        tipY > newest.y + newest.props.h
      ) {
        continue;
      }

      results.push({ imageShapeId: newest.id, instruction: text });
    }

    logCall("read-annotations", `找到 ${results.length} 条指令`);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

// 3) 用 stdio 这根管子把 server 接上线（等 AI 客户端来起它）
const transport = new StdioServerTransport();
await server.connect(transport);
