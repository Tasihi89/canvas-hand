# Scenario: Redraw an image from annotations

The user has drawn arrow annotations on an image and wants it modified / iterated per those annotations.

## Steps

1. **read-annotations**: read out "the shapeId of the latest annotated image + the text instruction of each arrow".
   - It only returns arrows on the **latest image** (deduplicated by id timestamp; arrows from older rounds/older images are not returned).
   - **Empty result** = the user hasn't annotated the latest image: stop and tell them "no annotations found on the latest image, please draw arrows on the latest image". Don't decide on your own to edit an old image or guess.
2. **look-at-marked-image**: get the screenshot with arrow annotations, to see which part of the image each instruction refers to.
   - Coordinates only tell you "which image"; the part to change must be seen by the AI's eyes via this screenshot.
3. **view_image**: load the annotated image into the conversation's view — imagegen must "see" the image to be edited first.
4. **imagegen in edit mode**:
   - Change only what's instructed (e.g. "shrink the subject", "compress the caption to one line", "use lighter colors");
   - List the invariants (parts that must not change), so it doesn't redraw the whole thing and drift.
5. **add-picture(new image path)**: place the redrawn image back on the canvas (auto-placed at far right, no overlap).
6. **Auto-refresh the sidebar canvas**: use control-in-app-browser to open/refresh the canvas address so the user sees the new image immediately. The canvas is only viewed in the Codex sidebar — no separate Chrome. (For the service address / how to open, see `open-canvas.md`.)

## Don't

- Don't write screenshot/drawing code yourself — use imagegen.
- Don't repeatedly inspect and regenerate — produce one version and hand it over.
- **Don't skip view_image and let imagegen edit directly** — without "seeing" the image it copies and fakes it, barely changing anything.
- Don't hand-write tldraw records to place images — use add-picture.
