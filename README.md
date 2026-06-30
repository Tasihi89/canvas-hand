# Canvas Hand

Canvas Hand is a local infinite canvas plugin for Codex. Powered by tldraw, it lets you generate images, annotate them with arrows, and have the AI redraw images based on your annotations — all inside Codex. The canvas runs as a local web service and embeds directly in the Codex in-app sidebar browser.

## Features

- Open a local tldraw infinite canvas in the Codex sidebar.
- Have Codex generate images with its built-in image model and drop them onto the canvas automatically.
- Use the "revise instruction" pen to draw arrows + text on the canvas, marking which part of which image to change.
- The AI reads your annotations, redraws the image per your instructions, and places it back on the canvas — a "generate → annotate → redraw" iteration loop.
- Canvas data is saved to a fixed directory `~/.canvas-hand/canvas/` — one canvas, reused everywhere.

## Installation

### Let Codex install it automatically

Send this to Codex:

```text
Please install the Canvas Hand Codex plugin from https://github.com/Tasihi89/canvas-hand.git.
Clone the repo to ~/plugins/canvas-hand, confirm .codex-plugin/plugin.json exists,
add the plugin to the personal marketplace by running codex plugin marketplace add ~,
then run codex plugin add canvas-hand@personal.
After installing, validate the plugin and tell me whether I need to start a new chat
to load the new skills and MCP tools.
```

### Manual installation

Clone the plugin to the location the Codex personal marketplace references by default:

```bash
mkdir -p ~/plugins
git clone https://github.com/Tasihi89/canvas-hand.git ~/plugins/canvas-hand
```

> No need to run `npm install` manually — the first time you open the canvas, `scripts/start-canvas.sh` installs dependencies automatically.

Make sure `~/.agents/plugins/marketplace.json` has a Canvas Hand entry:

```json
{
  "name": "personal",
  "interface": { "displayName": "Personal" },
  "plugins": [
    {
      "name": "canvas-hand",
      "source": { "source": "local", "path": "./plugins/canvas-hand" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

Then register the personal marketplace and install the plugin:

```bash
codex plugin marketplace add ~
codex plugin add canvas-hand@personal
```

After installing, start a new Codex chat so the new skills and MCP tools load fully.

## Usage

### Open the canvas

In Codex, say:

```text
Open my canvas
```

Canvas Hand starts the local service (default `http://127.0.0.1:8000/`) and opens the canvas in the sidebar. Canvas data is saved to `~/.canvas-hand/canvas/canvas.json`.

> The port must be 8000 (the MCP tools connect to it by default). If 8000 is taken, free it first.

### Generate a new image

In Codex, describe the image you want, for example:

```text
Generate a phone ad poster on my canvas
```

Codex generates the image with its built-in image model, drops it onto the canvas, and refreshes the sidebar so you see it immediately.

### Redraw from annotations

1. Use the "revise instruction" pen in the canvas toolbar to draw an arrow on the image you want to change and type your instruction (e.g. "make the subject smaller", "use lighter colors").
2. In Codex, say:

```text
Redraw this image based on my annotations on the canvas
```

Codex reads the annotations (which image, which part, what to change), redraws it, places it back on the canvas, and refreshes. The original is kept; the new image goes beside it.

> When iterating across rounds, only arrows on the **latest image** are processed — you're always iterating the image you just generated.

## Skills

- `canvas-hand`: the entry point, auto-routing by scenario to —
  - Open the canvas (`reference/open-canvas.md`)
  - Generate a new image (`reference/generate.md`)
  - Redraw from annotations (`reference/edit.md`)

## Local development

```bash
npm install
npm run dev
```

The canvas service is a Vite dev server — no build step needed.
