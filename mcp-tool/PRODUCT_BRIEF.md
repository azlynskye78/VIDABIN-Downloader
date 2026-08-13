# VIDABIN Downloader MCP Server — Product Brief (PRD)

## 1. Executive Summary

VIDABIN Downloader MCP Server is a Model Context Protocol server that enables AI agents to programmatically download YouTube multitrack audio, video, and subtitles. It wraps the battle-tested yt-dlp engine with intelligent batch processing, multi-cookie rotation, language-based track selection, and automatic format conversion.

**Target Users:**
- Content creators who need multilingual audio tracks from YouTube
- Translation agencies needing dubbed audio extraction at scale
- Media production teams requiring bulk video/audio downloads
- Anyone who wants AI-automated YouTube content extraction

**Core Value Proposition:**
Turn a manual, one-by-one download process into a fully automated AI-driven pipeline. Give the AI a list of 100+ videos with desired languages, and it handles everything — format detection, cookie rotation, download, conversion, retry on failure — delivering organized output folders.

---

## 2. Problem Statement

Currently, downloading multitrack audio from YouTube requires:
1. Opening a web UI tool for each video
2. Manually fetching formats and selecting audio tracks
3. Downloading one by one
4. Managing cookies when YouTube rate-limits

For 100+ videos, this takes hours of manual work. An MCP server eliminates all manual steps.

---

## 3. Technical Stack

| Component | Technology |
|-----------|------------|
| MCP SDK | `@modelcontextprotocol/sdk` (Node.js) |
| Transport | `stdio` (local) |
| Runtime | Node.js 18+ |
| Core Engine | yt-dlp (bundled binary) |
| Audio/Video Processing | FFmpeg (bundled binary) |
| JS Runtime for yt-dlp | deno.exe + node.exe (bundled) |
| Language | JavaScript (ES Modules) |

**Important:** The binaries (yt-dlp.exe, ffmpeg.exe, deno.exe, node.exe) are already bundled in the existing project's `bin/` directory at `d:\MyAI\Content create\Multitrack Audio download\bin\`. The MCP server must reference these same binaries.

---

## 4. MCP Tools Specification

### Tool 1: `check_dependencies`
**Description:** Verify that yt-dlp, ffmpeg, deno, and node binaries are present and working.

**Input:** None

**Output:**
```json
{
  "ytdlp": { "available": true, "version": "2026.07.04" },
  "ffmpeg": { "available": true },
  "deno": { "available": true },
  "node": { "available": true }
}
```

---

### Tool 2: `list_formats`
**Description:** List all available video and audio formats/tracks for a YouTube URL, including all dubbed language audio tracks.

**Input:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "cookies_file": "path/to/cookies.txt (optional)"
}
```

**Output:** Parsed structured data:
```json
{
  "title": "Video Title",
  "video_streams": [
    { "id": "137", "ext": "mp4", "resolution": "1920x1080", "fps": 30, "codec": "avc1", "size": "497MB" }
  ],
  "audio_streams": [
    { "id": "140-21", "ext": "m4a", "codec": "mp4a.40.2", "bitrate": "129k", "language": "en", "language_name": "English", "is_default": true },
    { "id": "251-11", "ext": "webm", "codec": "opus", "bitrate": "133k", "language": "bn", "language_name": "Bangla", "is_default": false },
    { "id": "251-2", "ext": "webm", "codec": "opus", "bitrate": "130k", "language": "hi", "language_name": "Hindi", "is_default": false }
  ]
}
```

**Critical Implementation Detail:** Must use `--extractor-args "youtube:player_client=default,web_embedded"` to ensure all dubbed audio tracks are discovered. The `tv` client is broken due to YouTube's SABR/DRM restrictions (as of 2026-07).

---

### Tool 3: `download_tracks`
**Description:** Download specific audio tracks, video streams, or combined video+audio for a single YouTube URL.

**Input:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "download_type": "audio_only | video_only | video_with_audio | video_with_all_audio",
  "languages": ["bn", "hi", "en"] or ["all"],
  "audio_format": "mp3 | wav | m4a | flac | aac",
  "video_quality": "best | 2160p | 1440p | 1080p | 720p | 480p | 360p",
  "video_format": "mkv | mp4 | webm",
  "subtitles": "none | all | en | auto",
  "audio_multistreams": false,
  "output_dir": "D:\\Downloads\\VIDABIN",
  "cookies_file": "path/to/cookies.txt (optional)",
  "max_retries": 3
}
```

**Output:**
```json
{
  "success": true,
  "title": "Video Title",
  "downloaded_files": [
    { "path": "D:\\Downloads\\VIDABIN\\Video Title\\mp3\\[bn] Video Title [f251-11].mp3", "language": "bn", "format": "mp3", "size_mb": 21.97 },
    { "path": "D:\\Downloads\\VIDABIN\\Video Title\\mp3\\[hi] Video Title [f251-2].mp3", "language": "hi", "format": "mp3", "size_mb": 21.42 }
  ],
  "failed_tracks": [],
  "total_downloaded": 2,
  "total_size_mb": 43.39
}
```

**Key Logic:**
1. First run `yt-dlp -F` to get all formats
2. Parse the output to find format IDs matching requested languages
3. For each matching format, download with retry logic (up to max_retries)
4. If `audio_format` is not `m4a` (the native format), use `--extract-audio --audio-format <format> --audio-quality 0` to convert
5. Output directory structure: `output_dir / Video Title / audio_format /`
6. Add delay between downloads to avoid rate limiting

---

### Tool 4: `batch_download`
**Description:** Process a batch of multiple videos from a JSON configuration object. This is the most powerful tool — handles 100+ videos with cookie rotation and progress tracking.

**Input:**
```json
{
  "batch_config": {
    "global_settings": {
      "output_dir": "D:\\Downloads\\VIDABIN",
      "audio_format": "mp3",
      "video_format": "mkv",
      "subtitles": "none",
      "max_retries": 3,
      "delay_between_downloads_sec": 5,
      "default_cookies_file": "D:\\cookies\\main.txt"
    },
    "videos": [
      {
        "url": "https://youtube.com/watch?v=...",
        "cookies_file": "D:\\cookies\\client1.txt",
        "download_type": "audio_only",
        "languages": ["bn", "hi"],
        "audio_format": "mp3"
      }
    ]
  }
}
```

Or alternatively, accept a file path:
```json
{
  "batch_file": "D:\\path\\to\\batch-config.json"
}
```

**Output:**
```json
{
  "total_videos": 6,
  "completed": 5,
  "failed": 1,
  "results": [
    { "url": "...", "title": "...", "status": "success", "files_downloaded": 3 },
    { "url": "...", "title": "...", "status": "failed", "error": "403 Forbidden after 3 retries" }
  ],
  "total_files_downloaded": 15,
  "total_size_mb": 450.5,
  "output_directory": "D:\\Downloads\\VIDABIN"
}
```

**Key Logic:**
1. Parse the batch config (from inline JSON or file path)
2. For each video, merge video-specific settings with global_settings
3. Use the video-specific `cookies_file` if provided, otherwise use `default_cookies_file`
4. Process videos sequentially (not parallel, to avoid YouTube blocks)
5. Add configurable delay between videos
6. Retry failed downloads up to max_retries times
7. Return comprehensive summary

---

### Tool 5: `update_binaries`
**Description:** Update yt-dlp to the latest version. This is important because YouTube frequently changes its API.

**Input:** None

**Output:**
```json
{
  "ytdlp": { "previous_version": "2026.07.04", "new_version": "2026.07.30", "updated": true },
  "message": "yt-dlp updated successfully"
}
```

---

### Tool 6: `convert_audio`
**Description:** Convert already-downloaded audio files from one format to another using FFmpeg.

**Input:**
```json
{
  "source_dir": "D:\\Downloads\\VIDABIN\\Video Title\\m4a",
  "target_format": "mp3",
  "output_dir": "D:\\Downloads\\VIDABIN\\Video Title\\mp3"
}
```

**Output:**
```json
{
  "converted": 5,
  "failed": 0,
  "files": [
    { "source": "...", "output": "...", "status": "success" }
  ]
}
```

---

## 5. Critical Implementation Details

### 5.1 YouTube Player Client Fix
```javascript
// MUST use this extractor-args to get all dubbed audio tracks
'--extractor-args', 'youtube:player_client=default,web_embedded'
// DO NOT use 'tv' client — it's broken due to SABR/DRM (as of 2026-07)
```

### 5.2 Binary Paths
All binaries are in the `bin/` directory relative to the project root:
```javascript
const YTDLP_PATH = path.join(__dirname, '..', 'bin', 'yt-dlp.exe');
const FFMPEG_PATH = path.join(__dirname, '..', 'bin', 'ffmpeg.exe');
const BIN_DIR = path.resolve(__dirname, '..', 'bin');

// Must add bin/ to PATH so yt-dlp can find deno.exe and node.exe
const customEnv = {
  ...process.env,
  PATH: `${BIN_DIR};${process.env.PATH}`
};
```

### 5.3 Format Parsing Logic
The yt-dlp `-F` output needs to be parsed to extract audio tracks with language codes:
```
251-11  webm  audio only  2 |  21.97MiB  133k https | audio only  opus  133k 48k [bn] Bangla, medium, webm_dash
```
Regex pattern to extract: `/^(\S+)\s+\S+\s+audio only.*\[(\w[\w-]*)\]\s+(.+?)(?:,|$)/`

Key fields: format_id, language_code, language_name

### 5.4 Cookie Handling
```javascript
// Priority: video-specific > global default > none
function getCookiesArg(videoConfig, globalConfig) {
  const cookiesFile = videoConfig.cookies_file || globalConfig.default_cookies_file;
  if (cookiesFile) {
    return ['--cookies', cookiesFile];
  }
  return [];
}
```

### 5.5 Output Directory Structure
```
output_dir/
└── [Video Title]/
    ├── mp3/
    │   ├── [bn] Video Title [f251-11].mp3
    │   ├── [hi] Video Title [f251-2].mp3
    │   └── [en] Video Title [f251-21].mp3
    ├── mkv/
    │   └── Video Title [f137+251-21].mkv
    └── wav/
        └── [bn] Video Title [f251-11].wav
```

Output template: `[%(language|na)s] %(title)s [f%(format_id)s].%(ext)s`

### 5.6 Audio Download + Conversion Logic
```javascript
const args = ['-f', formatId];

// If target format is different from native (m4a), convert
if (audioFormat !== 'm4a') {
  args.push('--extract-audio', '--audio-format', audioFormat, '--audio-quality', '0');
}

// Output path
args.push('-P', finalOutputDir);
args.push('-o', '[%(language|na)s] %(title)s [f%(format_id)s].%(ext)s');
args.push('--ffmpeg-location', path.join(__dirname, '..', 'bin'));
```

---

## 6. Secrets & Configuration

| Secret/Config | Type | Description |
|--------------|------|-------------|
| Cookies files | File paths | Netscape HTTP Cookie files from YouTube accounts |
| Output directory | File path | Where downloads are saved |
| Binary paths | File path | Path to bin/ folder with yt-dlp, ffmpeg, deno, node |

No API keys needed — all operations are local.

---

## 7. Deployment

- **Transport:** stdio (local execution)
- **Platform:** Windows (primary), cross-platform possible
- **Installation:** npm install, then configure in AI agent's MCP settings

---

## 8. Error Handling Strategy

1. **403 Forbidden:** Retry with different cookies or after delay
2. **Rate limiting:** Exponential backoff (3s, 6s, 9s between retries)
3. **Missing audio tracks:** Log warning, continue with available tracks
4. **Network errors:** Retry up to max_retries
5. **Invalid URL:** Return clear error message
6. **Missing binaries:** Return dependency check results

---

## 9. Success Metrics

- Successfully download 100+ videos in a single batch
- Support 20+ language audio tracks per video
- Cookie rotation prevents rate limiting
- Zero manual intervention required
- Organized output folder structure
