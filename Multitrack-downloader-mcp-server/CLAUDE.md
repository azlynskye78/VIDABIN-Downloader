# VIDABIN Multitrack Audio MCP Server

## Project Structure
- `index.js` — Main entry point & MCP server tool registration (StdioServerTransport)
- `tools/` — Handler functions for each tool (`check-deps`, `list-formats`, `download`, `batch`, `update`, `convert`)
- `lib/` — Core business logic modules (`binary-manager`, `format-parser`, `cookie-manager`, `retry-handler`, `output-organizer`, `yt-dlp-executor`)
- `bin/` — Bundled binaries (`yt-dlp.exe`, `ffmpeg.exe`, `deno.exe`, `node.exe`)

## Commands
- `npm start` — Start MCP Server on stdio
- `node -c index.js` — Verify syntax
- `npm test` — Run tests

## Key Tools Implemented
1. `check_dependencies` — Verifies yt-dlp, ffmpeg, deno, node existence and version
2. `list_formats` — Lists all video and multi-language dubbed audio tracks
3. `download_tracks` — Single video track extractor with language filter & format conversion
4. `batch_download` — Batch processing for 100+ videos with cookie rotation
5. `update_binaries` — Updates yt-dlp to latest version
6. `convert_audio` — Batch audio conversion via FFmpeg
