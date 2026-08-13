# VIDABIN Multitrack Download MCP (`vidabin-multitrack-download-mcp`)

AI-powered YouTube multitrack audio extractor — download dubbed audio tracks in 20+ languages with batch processing, cookie rotation, and format conversion via MCP protocol.

[![Available on MCPize](https://img.shields.io/badge/MCPize-Available-blue)](https://mcpize.com/servers/vidabin-multitrack-download-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Key Features

- 🎧 **Multi-Language Audio Extraction**: Discover and extract YouTube Multi-Language Audio (MLA) dubbed tracks in 20+ languages (bn, hi, en, es, fr, de, ja, ko, etc.).
- 🛡 **SABR/DRM Bypass Engine**: Configured with `player_client=default,web_embedded` to reveal hidden language streams.
- 📦 **Batch Processing (100+ Videos)**: Process bulk videos using structured JSON configs with automated delays and cookie rotation.
- 🍪 **Cookie Manager & Rotation**: Automatic fallback and multi-cookie management to prevent YouTube 403 Forbidden / rate limits.
- 🔄 **Format Conversion**: Convert extracted audio seamlessly to MP3, WAV, FLAC, M4A, or AAC via bundled FFmpeg.

---

## 🛠 Implemented MCP Tools

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| `check_dependencies` | Check availability and versions of yt-dlp, ffmpeg, deno, and node binaries | None |
| `list_formats` | List all video and dubbed audio streams for a YouTube URL with ISO language codes | `url`, `cookies_file` |
| `download_tracks` | Download specific language audio streams, video, or combined media | `url`, `languages`, `audio_format`, `download_type`, `output_dir` |
| `batch_download` | Batch process multiple videos from JSON config with cookie rotation | `batch_config` or `batch_file` |
| `update_binaries` | Auto-update yt-dlp binary to latest release | None |
| `convert_audio` | Batch convert audio files in a directory using FFmpeg | `source_dir`, `target_format`, `output_dir` |

---

## 🚀 Connect & Quick Start

### Option 1: Install from MCPize (Recommended)
Visit [mcpize.com/servers/vidabin-multitrack-download-mcp](https://mcpize.com/servers/vidabin-multitrack-download-mcp)

### Option 2: Connect via CLI
```bash
npx -y mcpize connect vidabin-multitrack-download-mcp --client claude
```

### Option 3: Manual Client Configuration
Add the following to your `claude_desktop_config.json` or `.gemini/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "vidabin-multitrack-download-mcp": {
      "command": "node",
      "args": [
        "D:\\MyAI\\Content create\\Multitrack Audio download\\mcp-server\\index.js"
      ]
    }
  }
}
```

---

## 💻 Development & Deployment

```bash
# Test local syntax & health
npm start

# Test with MCPize dev server
npx mcpize dev

# Deploy & Publish to MCPize Cloud
npx mcpize deploy
npx mcpize publish --auto
```

---

## 📜 License
MIT License — Copyright (c) 2026 VIDABIN
