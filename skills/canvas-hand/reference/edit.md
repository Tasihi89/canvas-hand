# Scenario: Redraw an image from annotations

The user has drawn arrow annotations on an image and wants it modified / iterated per those annotations.

## Steps

1. **read-annotations**: read out "the shapeId of the latest annotated image + the text instruction of each arrow".
   - It only returns arrows on the **latest image** (deduplicated by id timestamp; arrows from older rounds/older images are not returned).
   - **Empty result** = the user hasn't annotated the latest image: stop and tell them "no annotations found on the latest image, please draw arrows on the latest image". Don't decide on your own to edit an old image or guess.
2. **look-at-marked-image**: get the screenshot with arrow annotations, to see which part of the image each instruction refers to.
   - Coordinates only tell you "which image"; the part to change must be seen by the AI's eyes via this screenshot.
3. **view_image**: load the annotated image into the conversation's view — imagegen must "see" the image to be edited first. (This is the ONLY view_image needed — before editing. Do not view_image again after editing.)
4. **imagegen in edit mode**:
   - Change only what's instructed (e.g. "shrink the subject", "compress the caption to one line", "use lighter colors");
   - List the invariants (parts that must not change), so it doesn't redraw the whole thing and drift.
5. **add-picture(new image path)**: the moment imagegen returns, take its result path (under `$CODEX_HOME/generated_images/...`) and pass it straight to add-picture. Placed at far right, no overlap. add-picture embeds the image into canvas.json, so the file location doesn't matter.
6. **Auto-refresh the sidebar canvas**: use control-in-app-browser to open/refresh the canvas address so the user sees the new image immediately. The canvas is only viewed in the Codex sidebar — no separate Chrome. (For the service address / how to open, see `open-canvas.md`.)

## Don't

- **After imagegen returns the edited image, call add-picture with that path — nothing in between.** No `find` to locate the file, no `cp`/move into the project, no second `view_image` to "check the new version", no "let me confirm it's correct". The path is already in imagegen's result and add-picture embeds the image anyway. (Each of these extra steps costs a slow model round-trip — they added ~3 minutes for zero benefit.)
- Don't write screenshot/drawing code yourself — use imagegen.
- Don't repeatedly inspect and regenerate — produce one version and place it.
- **Don't skip the pre-edit view_image (step 3)** — without "seeing" the image first, imagegen copies and fakes it, barely changing anything.
- Don't hand-write tldraw records to place images — use add-picture.
