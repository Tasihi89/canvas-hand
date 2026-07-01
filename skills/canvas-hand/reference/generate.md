# Scenario: Generate a new image onto the canvas

The user wants to generate an image from scratch and place it on the canvas.

## Steps

1. Generate the image with Codex's built-in **imagegen** (one shot).
2. **Take the image path directly from imagegen's result** (it lives under `$CODEX_HOME/generated_images/...`) and pass that exact path to `add-picture`. Do NOT `find` for it, do NOT `cp`/move it into the project first.
3. Use canvas-hand's **`add-picture(filePath)`** to place it on the canvas.
   add-picture reads the image's real dimensions, scales proportionally, and scans the canvas to place it at the far right without overlap — you don't need to worry about size or coordinates. It also embeds the image into canvas.json, so the original file's location doesn't matter — no need to copy it anywhere.
4. **Auto-refresh the sidebar canvas after placing** (so the user sees the new image immediately): use control-in-app-browser to open the canvas address; if the sidebar is already at that address, just refresh. The canvas is only viewed in the Codex sidebar — no separate Chrome. (For the service address / how to open, see `open-canvas.md`.)

## Don't

- **The moment imagegen returns, call add-picture with that path — nothing in between.** No `find` to locate the file, no `cp`/move into the project, no re-inspecting the image, no "let me confirm it's the right one". The image is already done and its path is in imagegen's result. (These extra steps each cost a slow model round-trip — they added minutes for zero benefit, since add-picture embeds the image anyway.)
- **Don't write HTML/CSS + Pillow/Playwright screenshot code to "draw" the image** — slow and crude. Use imagegen directly.
- **Don't repeatedly inspect and regenerate** — produce one version and place it. Don't act as your own QC reviewer.
- Don't hand-write tldraw asset/shape records to put images on the canvas — use add-picture.
