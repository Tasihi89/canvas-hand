---
name: canvas-hand
description: Operate "my canvas" (a local infinite canvas) for image work — open the canvas, generate new images onto it, and redraw images based on arrow annotations drawn on the canvas. Use when the user wants to open the canvas, generate an image onto it, or modify/iterate an image already on the canvas (even without saying "canvas" explicitly — phrases like "change the background", "redraw this", "tweak this image" count too).
---

# Canvas Hand

The entry point for operating the local infinite canvas. First decide which scenario the user wants, then read the matching reference and follow it.

## Common rules
- Images you generate or modify must be **placed onto the canvas**, not just returned in chat.
- The canvas service runs at `http://127.0.0.1:8000`. The port **must be 8000** (the MCP tools connect to it by default); if 8000 is taken, free it first rather than letting the service fall back to another port.
- Operate canvas data with the canvas-hand MCP tools (`read-annotations` / `look-at-marked-image` / `look-at-picture` / `add-picture` / `count-shapes`). Do not hand-write tldraw asset/shape records.

## Three scenarios — read the matching reference
1. **Open canvas** — the user wants to open / view / enter the canvas.
   → see `reference/open-canvas.md`
2. **Generate a new image** — the user wants to create an image from scratch and place it on the canvas.
   → see `reference/generate.md`
3. **Redraw from annotations** — the user has drawn arrow annotations on an image and wants it modified / iterated per those annotations.
   → see `reference/edit.md`
