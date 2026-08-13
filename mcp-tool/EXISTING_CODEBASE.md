# VIDABIN Downloader — Existing Codebase Reference

This document describes the existing web-based VIDABIN Downloader tool that the MCP server must replicate in functionality.

## Project Location
`d:\MyAI\Content create\Multitrack Audio download\`

## Existing Server APIs (server.js)

The current Express.js server provides these REST APIs:

### API 1: GET `/api/check-deps`
Checks if yt-dlp.exe and ffmpeg.exe are accessible.

### API 2: POST `/api/list-formats`
- Input: `{ url, authMode, browserName }`
- Runs: `yt-dlp --extractor-args "youtube:player_client=default,web_embedded" -F <url>`
- Also fetches video title via `--print title`
- Returns: `{ stdout, stderr, title }`

### API 3: GET `/api/download` (SSE - Server-Sent Events)
- Input query params: url, formatId, outputDir, format, subtitles, audioMultistreams, authMode, browserName, audioFormat, itemType, videoTitle
- Spawns yt-dlp with format selection
- Streams progress via SSE events
- Output template: `[%(language|na)s] %(title)s [f%(format_id)s].%(ext)s`
- Organizes output: `outputDir / videoTitle / audioFormat/`

### API 4: GET `/api/convert-mp4-to-mp3`
- Converts all MP4 files in Downloads/ to MP3
- Uses FFmpeg with `-q:a 0 -map a`

### API 5: GET `/api/update-binaries`
- Updates yt-dlp via `yt-dlp -U`
- Downloads latest deno.exe from GitHub

## Key Configuration

### Binaries Path
```javascript
const YTDLP_PATH = '.\\bin\\yt-dlp.exe';
const FFMPEG_PATH = '.\\bin\\ffmpeg.exe';
const BIN_DIR = path.resolve(process.cwd(), 'bin');
```

### Custom Environment (CRITICAL)
```javascript
const customEnv = {
  ...process.env,
  PATH: `${BIN_DIR};${process.env.PATH}`
};
```
This adds bin/ to PATH so yt-dlp can find deno.exe and node.exe for JavaScript challenges.

### YouTube Player Client (CRITICAL)
```javascript
'--extractor-args', 'youtube:player_client=default,web_embedded'
```
**DO NOT use `tv` client** — it triggers SABR/DRM restrictions and hides multitrack audio.

### Cookie Handling
```javascript
async function getCookiesPath() {
  // Checks for cookies.txt in project root or parent directory
}

const buildAuthArgs = async (authMode, browserName) => {
  const args = ['--extractor-args', 'youtube:player_client=default,web_embedded'];
  if (authMode === 'browser' && browserName) {
    args.push('--cookies-from-browser', browserName);
  } else {
    const cookiesPath = await getCookiesPath();
    if (cookiesPath) args.push('--cookies', cookiesPath);
  }
  return args;
};
```

### Audio Download Logic
```javascript
// When itemType === 'audio' and audioFormat !== 'm4a':
args.push('--extract-audio', '--audio-format', audioFormat, '--audio-quality', '0');

// Output directory structure:
// outputDir / videoTitle / audioFormat/
```

### Frontend Download Logic (App.jsx)

The frontend supports 3 download modes:
1. **Audio Bulk Mode** — Multiple audio tracks downloaded individually
2. **Video Bulk Mode** — Multiple videos downloaded sequentially
3. **Single/Merge Mode** — One video + multiple audio tracks merged

Retry logic: 3 attempts with exponential backoff (3s, 6s, 9s delay).

## Existing File Structure
```
Multitrack Audio download/
├── server.js           # Express.js backend
├── start.bat           # Launcher script
├── package.json        # Project dependencies
├── cookies.txt         # YouTube cookies (Netscape format)
├── bin/
│   ├── yt-dlp.exe      # YouTube downloader engine
│   ├── ffmpeg.exe      # Audio/video processor
│   ├── deno.exe        # JS runtime for YouTube challenges
│   └── node.exe        # JS runtime (alternative)
├── src/
│   ├── App.jsx         # React frontend
│   └── components/
│       ├── FormatParser.jsx
│       ├── CommandPreview.jsx
│       └── TerminalLog.jsx
├── dist/               # Built frontend
└── Downloads/          # Default output directory
```

## Default Settings
- Audio format: MP3
- Video format: MKV
- Output directory: .\Downloads
- Subtitles: none
- Max retries: 3
- Delay between bulk downloads: 1.5 seconds
```
