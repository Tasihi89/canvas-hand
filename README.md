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

Send this to Codex — it describes the goal, so Codex uses whatever install method its current version supports:

```text
Please install the Canvas Hand Codex plugin from https://github.com/Tasihi89/canvas-hand.git.
Steps:
1. Clone the repo to ~/plugins/canvas-hand and confirm .codex-plugin/plugin.json exists.
2. Register it in my personal marketplace and enable it, using whatever your current
   codex version supports. If the `codex plugin ...` CLI subcommands aren't available,
   do it by editing the config files directly:
   - add a "canvas-hand" entry to ~/.agents/plugins/marketplace.json (source.path
     "./plugins/canvas-hand"), and
   - add [plugins."canvas-hand@personal"] with enabled = true to ~/.codex/config.toml.
3. Tell me to restart Codex, then confirm Canvas Hand shows up in the Plugins panel.
```

### Manual installation

The config-file method below is version-independent and always works. (The `codex plugin ...`
CLI commands exist in some versions — see the optional note at the end.)

**1. Clone the plugin:**

```bash
mkdir -p ~/plugins
git clone https://github.com/Tasihi89/canvas-hand.git ~/plugins/canvas-hand
```

> No need to run `npm install` — the first time you open the canvas, `scripts/start-canvas.sh` installs dependencies automatically.

**2. Register it in the personal marketplace** — make sure `~/.agents/plugins/marketplace.json` has a `canvas-hand` entry in its `plugins` array (create the file if it doesn't exist):

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

**3. Enable the plugin** — add this to `~/.codex/config.toml`:

```toml
[plugins."canvas-hand@personal"]
enabled = true
```

**4. Restart Codex.** Canvas Hand should appear in the Plugins panel. Start a new chat so the skills and MCP tools load fully.

> **Optional (CLI):** if your codex version supports the plugin subcommands, you can register the marketplace with `codex plugin marketplace add ~` instead of hand-editing files. Availability varies by version — the config-file method above is the reliable path.

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
