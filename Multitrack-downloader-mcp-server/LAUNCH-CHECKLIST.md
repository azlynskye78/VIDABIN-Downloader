# Launch Checklist: VIDABIN Multitrack Download MCP (`vidabin-multitrack-download-mcp`)

## Pre-Launch
- [x] Server name renamed to `vidabin-multitrack-download-mcp` across all project files
- [x] `mcpize doctor` passed (7 checks passed, 0 failed)
- [x] Pre-publish unit and sanity tests passing (`node test/sanity-test.js`)
- [x] `README.md` updated with MCPize badges + install snippets
- [x] `mcpize.yaml` configured with `runtime: node20`
- [ ] User authenticated via `npx mcpize login`

## Launch Execution
- [ ] Deploy to MCPize Cloud: `npx mcpize deploy --skip-wizard --yes`
- [ ] Publish to MCPize Marketplace: `npx mcpize publish --auto`
- [ ] Verify live endpoint status: `npx mcpize status`

## Go-to-Market & Social Share
- [ ] Post Twitter/X launch tweet
- [ ] Share on Reddit (r/mcp, r/youtube)
- [ ] Share in MCP Discord & Developer communities
