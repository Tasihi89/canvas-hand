import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Tldraw, getSnapshot, loadSnapshot, StateNode, createShapeId, toRichText, DefaultToolbar, TldrawUiMenuToolItem, useTools, useIsToolSelected } from "tldraw";
import "tldraw/tldraw.css";

// 改图指令工具的自定义图标（画笔 + 星火：标注 + AI 改图）。
// tldraw 用 CSS mask 渲染图标，颜色由 CSS 控制；和其他工具一样用默认黑色。
const REVISE_ICON_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cGF0aCBkPSJNMi41IDEzLjUgTCAzLjIgMTEgTCA5LjIgNSBMIDExIDYuOCBMIDUgMTIuOCBaIiBmaWxsPSJibGFjayIvPjxwYXRoIGQ9Ik05LjIgNSBMIDEwLjQgMy44IEEgMSAxIDAgMCAxIDExLjggMy44IEwgMTIuMiA0LjIgQSAxIDEgMCAwIDEgMTIuMiA1LjYgTCAxMSA2LjggWiIgZmlsbD0iYmxhY2siLz48cGF0aCBkPSJNMTIuNSAxIEwgMTMgMi4zIEwgMTQuMyAyLjggTCAxMyAzLjMgTCAxMi41IDQuNiBMIDEyIDMuMyBMIDEwLjcgMi44IEwgMTIgMi4zIFoiIGZpbGw9ImJsYWNrIi8+PC9zdmc+";

// ===== M6.3.1：自造一支「改图指令」笔 =====
// 它是一个状态机(StateNode)：记得住"按下→拖→松"这个过程。
// 和 tldraw 自带箭头的唯一区别：start/end 都是纯坐标、不带 binding，所以不吸附、能自由戳进图。
class ReviseInstructionTool extends StateNode {
  static id = "revise-instruction"; // 这支笔的代号

  arrowId = null; // 正在画的这根箭头的 id
  tip = null;     // 尖端 = 按下点（固定，扎在图上）

  onPointerDown() {
    // 按下：把箭头"锚"在尖端这一点，当场造出来（A 方案：拖动时实时可见）
    this.tip = this.editor.inputs.currentPagePoint.clone();
    const id = createShapeId();
    this.arrowId = id;
    this.editor.createShape({
      id,
      type: "arrow",
      x: this.tip.x,                 // 箭头自身位置锚在尖端
      y: this.tip.y,
      props: {
        end: { x: 0, y: 0 },         // 尖端（=锚点，固定不动，箭头在这头）
        start: { x: 0, y: 0 },       // 尾巴（先和尖端重合，下面拖动时再拉开）
        arrowheadStart: "none",
        arrowheadEnd: "arrow",
        color: "red",
        richText: toRichText(""),
      },
    });
  }

  onPointerMove() {
    // 拖动：只要还按着，就实时把尾巴(start)更新到当前鼠标位置 → 看见箭头被拉出来
    if (!this.arrowId || !this.editor.inputs.isPointing) return;
    const p = this.editor.inputs.currentPagePoint;
    this.editor.updateShape({
      id: this.arrowId,
      type: "arrow",
      props: {
        start: { x: p.x - this.tip.x, y: p.y - this.tip.y }, // 尾巴相对尖端的偏移
      },
    });
  }

  onPointerUp() {
    if (!this.arrowId) return;
    const id = this.arrowId;
    // 松手即可直接打字（不用选中/双击）：选中它 + 进入文字编辑
    this.editor.select(id);
    this.editor.setEditingShape(id);
    // 把文字标签挪到尾巴(start=0)那头。放在进编辑之后设，避免被编辑流程重置。
    this.editor.updateShape({
      id,
      type: "arrow",
      props: { labelPosition: 0 },
    });
    // 注意：不切回 select —— 留在本工具，可以连续画，直到用户自己点别的工具

    this.arrowId = null;
    this.tip = null;
  }
}

// ===== M6.3.3：导出"被戳的那张图 + 它身上所有箭头"成一张 PNG，存盘 =====
// 关键：按 id 清单渲染，不按面积框选 —— 历史图不在清单里就绝不会进来。
// 较真点全在"算准这根箭头戳的是哪张图"（同 M6.3.2 后端 read-annotations 的坐标几何）。
async function exportMarkedImage(editor, arrow) {
  // ① 这根箭头的尖端绝对坐标 = 箭头自身位置(x,y) + end 偏移
  const tipX = arrow.x + arrow.props.end.x;
  const tipY = arrow.y + arrow.props.end.y;

  // ② 找尖端落在哪张 image 的相框矩形里 = 被戳的那张图
  const images = editor.getCurrentPageShapes().filter((s) => s.type === "image");
  const target = images.find(
    (img) =>
      tipX >= img.x && tipX <= img.x + img.props.w &&
      tipY >= img.y && tipY <= img.y + img.props.h
  );
  if (!target) return; // 没戳中任何图（戳空白）→ 不导

  // ③ 组形状清单 = 这张图 + 戳它的所有箭头（不止刚画那根，把图上历史箭头都算进来）
  const arrowsOnTarget = editor.getCurrentPageShapes().filter((s) => {
    if (s.type !== "arrow") return false;
    const ex = s.x + s.props.end.x;
    const ey = s.y + s.props.end.y;
    return (
      ex >= target.x && ex <= target.x + target.props.w &&
      ey >= target.y && ey <= target.y + target.props.h
    );
  });
  const ids = [target.id, ...arrowsOnTarget.map((a) => a.id)];

  // ④ 只渲染这几个形状 → data URL（= base64），POST 给后端写成 marked.png
  const { url } = await editor.toImageDataUrl(ids, { format: "png", background: true });
  fetch("/api/save-png", { method: "POST", body: url });
}

// 画布一装好就执行这里，editor 就是画布的“遥控器”
async function onCanvasMount(editor) {
  // ===== 第一步：开局先读，把上次存的画灌回来（必须在开监工之前）=====
  const res = await fetch("/api/load"); // ⭐前后端衔接就在这一行：前端去敲后端的 /api/load 门
  const snapshot = await res.json();    // 把后端交回的 JSON 解析出来
  loadSnapshot(editor.store, snapshot); // 把这份画灌回画布（还原上次的样子）

  // ===== 第二步：灌完了，再挂监工（之后你真正的新操作才被存）=====
  editor.store.listen(
    () => {
      const snap = getSnapshot(editor.store); // 把整块画布打包成 JSON
      fetch("/api/save", {                    // 发给服务员存盘
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snap),
      });
    },
    { scope: "document", source: "user" } // 只在“用户改了文档内容”时才存
  );

  // ===== M6.3.1 收尾：实现"连续画"=====
  // 痛点：tldraw 富文本编辑结束后会停在 select 工具，导致画完一根就跳走。
  // 办法：盯住"是否在编辑"，从"在编辑"翻到"不编辑"的那一刻（=用户写完字），
  //       如果刚画的是我们的标注箭头，就把工具切回「改图指令」，可以接着画。
  let wasEditing = false;
  let lastEditedId = null;
  editor.store.listen(() => {
    const editingId = editor.getEditingShapeId();
    if (editingId) {
      wasEditing = true;
      lastEditedId = editingId; // 记住正在编辑哪根
    } else if (wasEditing) {
      wasEditing = false;
      // 刚结束编辑：如果那根是 arrow（我们的标注笔画的），切回改图指令工具 + 导出标记图
      const shape = lastEditedId && editor.getShape(lastEditedId);
      if (shape && shape.type === "arrow") {
        editor.setCurrentTool("revise-instruction");
        exportMarkedImage(editor, shape); // ⭐刚确定一条标注 → 截【被戳的图+它身上所有箭头】存盘
      }
      lastEditedId = null;
    }
  });

  // ===== 写完字按回车 = 直接完成（不换行）=====
  // 富文本编辑器在 DOM 层吃回车做换行，StateNode 钩子拦不到，得在捕获阶段拦 keydown。
  // 纯回车（不带 shift/cmd/alt/ctrl）且正在编辑箭头时：阻止换行，直接结束编辑。
  const container = editor.getContainer();
  container.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.isComposing) return; // 中文输入法选词时的回车不算（避免误结束）
      const id = editor.getEditingShapeId();
      if (!id) return;
      const shape = editor.getShape(id);
      if (shape && shape.type === "arrow") {
        e.preventDefault();
        e.stopPropagation();
        editor.setEditingShape(null); // 结束编辑 = 完成
      }
    },
    true // capture 阶段，抢在富文本编辑器之前
  );
}

const container = document.getElementById("root");

// 把自造的笔装进画布：
// 1) tools 把笔交给画布；2) overrides 给它在工具栏配一个按钮（图标借自带的 arrow、名字「改图指令」）
const customTools = [ReviseInstructionTool];

const uiOverrides = {
  tools(editor, tools) {
    tools["revise-instruction"] = {
      id: "revise-instruction",
      icon: "revise-instruction",  // 对应 assetUrls.icons 里注册的自定义图标
      label: "改图指令",
      kbd: "g",                     // 快捷键 G，tldraw 原生 tooltip 会显示成「改图指令 — G」
      onSelect() {
        editor.setCurrentTool("revise-instruction");
      },
    };
    return tools;
  },
};

// 自定义 Toolbar：
// - maxItems/minItems=3 → 主栏只显示前 4 个（改图指令/选择/橡皮/文字）。
//   注意 tldraw 内部判断是 mainItemCount <= itemsToShow（含等号），所以要的是「4 个」就传 3。
// - 改图指令用和其他工具相同的 TldrawUiMenuToolItem → tooltip/hover/时机完全一致、纯图标、同样黑色
// - 其余工具（手/画笔/箭头/便签/图片）自动进「∧」溢出菜单
const components = {
  Toolbar(props) {
    const tools = useTools();
    const sel = (id) => useIsToolSelected(tools[id]);
    return (
      <DefaultToolbar {...props} maxItems={3} minItems={3}>
        <TldrawUiMenuToolItem toolId="revise-instruction" isSelected={sel("revise-instruction")} />
        <TldrawUiMenuToolItem toolId="select" isSelected={sel("select")} />
        <TldrawUiMenuToolItem toolId="eraser" isSelected={sel("eraser")} />
        <TldrawUiMenuToolItem toolId="text" isSelected={sel("text")} />
        <TldrawUiMenuToolItem toolId="hand" isSelected={sel("hand")} />
        <TldrawUiMenuToolItem toolId="draw" isSelected={sel("draw")} />
        <TldrawUiMenuToolItem toolId="arrow" isSelected={sel("arrow")} />
        <TldrawUiMenuToolItem toolId="note" isSelected={sel("note")} />
        <TldrawUiMenuToolItem toolId="asset" isSelected={sel("asset")} />
      </DefaultToolbar>
    );
  },
};

// 不用 StrictMode：它会“装了又卸”来体检，和我们的 async onMount 八字不合（会报 fn is not a function）。
// 改造 onMount 扛住生命周期是个独立大概念，留待以后单开一格学。
createRoot(container).render(
  <div style={{ position: "fixed", inset: 0 }}>
    <Tldraw
      onMount={onCanvasMount}
      tools={customTools}
      overrides={uiOverrides}
      components={components}
      assetUrls={{ icons: { "revise-instruction": REVISE_ICON_DATA_URI } }}
    />
  </div>
);

