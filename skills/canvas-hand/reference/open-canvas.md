# Scenario: Open the canvas

Open the canvas in the Codex in-app sidebar browser, fully automatic: the AI ensures the service is running + opens the browser. The user can then draw and annotate directly on the canvas.

## Steps

1. **First curl-check whether the service is running (key, don't skip)**: `curl -s http://127.0.0.1:8000/api/load`.
   - Got a response (canvas JSON or empty) → service already running on 8000, go straight to step 3 (**do not restart it**).
   - `Connection refused` → not running, go to step 2.
2. **Only start it if not running**: use the plugin's bundled startup script (it self-locates the plugin dir and saves canvas data to a fixed directory `~/.canvas-hand/canvas`). Run it in the background, non-blocking:
   ```
   ./scripts/start-canvas.sh
   ```
   - No arguments needed — there is one fixed canvas, reused every time.
   - The script starts on port 8000 (the MCP tools also connect to 8000 by default — must match). Confirm the address from its printed `Local:` line.
3. **Use control-in-app-browser to open** the address from step 1/2 in the sidebar.
   Connect the browser, read its docs, navigate, make visible — follow that skill's instructions, not repeated here.

## Don't

- **Don't start without curl-checking first**: the AI has no memory; restarting on every "open canvas" leaves zombie servers and the port keeps sliding. Check first, start only if needed (idempotent: if it's running, just use it).
- **The port must be 8000**: the MCP tools connect to `http://127.0.0.1:8000` by default. If 8000 is taken by something else, free it first — don't let the canvas service slide to 8001/8002, or the MCP can't reach the canvas and the loop breaks.
- **Don't write browser control code yourself** (the Node REPL approach) — control-in-app-browser already wraps it, use it directly.
- Don't "fix" or rebuild canvas.json just because the canvas is empty — an empty canvas is normal.
