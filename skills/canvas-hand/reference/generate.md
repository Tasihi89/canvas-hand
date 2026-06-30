# Scenario: Generate a new image onto the canvas

The user wants to generate an image from scratch and place it on the canvas.

## Steps

1. Generate the image with Codex's built-in **imagegen** (one shot).
2. **Save the generated image to a local png file** and get its absolute path.
3. Use canvas-hand's **`add-picture(filePath)`** to place it on the canvas.
   add-picture reads the image's real dimensions, scales proportionally, and scans the canvas to place it at the far right without overlap — you don't need to worry about size or coordinates.
4. **Auto-refresh the sidebar canvas after placing** (so the user sees the new image immediately): use control-in-app-browser to open the canvas address; if the sidebar is already at that address, just refresh. The canvas is only viewed in the Codex sidebar — no separate Chrome. (For the service address / how to open, see `open-canvas.md`.)

## Don't

- **Don't write HTML/CSS + Pillow/Playwright screenshot code to "draw" the image** — slow and crude (once took ~10 min, poor quality). Use imagegen directly.
- **Don't repeatedly inspect and regenerate in the middle** — produce one version and hand it to the user; don't act as your own QC reviewer (this once dragged it out to 6-8 min).
- Don't hand-write tldraw asset/shape records to put images on the canvas — use add-picture.
