# VIDABIN MCP Server — Architecture & Technical Reference

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (Claude/Gemini)                  │
│  "Download Bangla & Hindi audio from these 100 videos"      │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol (stdio)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               VIDABIN MCP Server (Node.js)                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  MCP Tool Layer                       │   │
│  │  check_dependencies | list_formats | download_tracks  │   │
│  │  batch_download | update_binaries | convert_audio     │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │               Core Engine Layer                       │   │
│  │  Format Parser | Cookie Manager | Retry Handler       │   │
│  │  Batch Processor | Output Organizer                   │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │              Binary Execution Layer                   │   │
│  │  yt-dlp.exe | ffmpeg.exe | deno.exe | node.exe        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  File System   │
              │  Downloads/    │
              │  cookies/      │
              └───────────────┘
```

## Data Flow: Batch Download

```
1. AI receives user prompt (natural language + links)
2. AI constructs batch_config JSON from user's request
3. AI calls batch_download tool with the config
4. MCP Server:
   a. Parses batch config
   b. For each video:
      i.   Select cookies (video-specific or global)
      ii.  Run yt-dlp -F to list formats
      iii. Parse format list to find matching language tracks
      iv.  For each matching track:
           - Build yt-dlp download command
           - Execute with retry logic
           - Track progress
      v.   Wait delay_between_downloads_sec
   c. Collect results
5. MCP Server returns structured results to AI
6. AI presents summary to user
```

## Format Parser — How yt-dlp Output is Parsed

### Raw yt-dlp -F output example:
```
ID      EXT  RESOLUTION FPS CH │   FILESIZE   TBR PROTO │ VCODEC        VBR  ACODEC       ABR ASR MORE INFO
───────────────────────────────────────────────────────────────────────────
140-21  m4a  audio only      2 │   21.35MiB  129k https │ audio only         mp4a.40.2   129k 44k [en] English original (default), medium, m4a_dash
251-11  webm audio only      2 │   21.97MiB  133k https │ audio only         opus        133k 48k [bn] Bangla, medium, webm_dash
251-2   webm audio only      2 │   21.42MiB  130k https │ audio only         opus        130k 48k [hi] Hindi, medium, webm_dash
137     mp4  1920x1080   30    │  497.39MiB 3017k https │ avc1.640028  3017k video only          1080p, mp4_dash
```

### Parsed structure:
```javascript
// Audio stream parsing regex:
// Matches lines like: 251-11  webm  audio only  ... [bn] Bangla, ...
const audioRegex = /^(\S+)\s+(\S+)\s+audio only\s+.*?\[(\S+?)\]\s+(.+?)(?:,\s*(\w+),)?/;

// Video stream parsing regex:
const videoRegex = /^(\S+)\s+(\S+)\s+(\d+x\d+)\s+(\d+)\s/;

function parseFormats(rawOutput) {
  const lines = rawOutput.split('\n');
  const audioStreams = [];
  const videoStreams = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for audio
    if (trimmed.includes('audio only')) {
      const match = trimmed.match(audioRegex);
      if (match) {
        audioStreams.push({
          id: match[1],
          ext: match[2],
          language: match[3],
          language_name: match[4].split(',')[0].trim(),
          is_default: trimmed.includes('(default)')
        });
      }
    }
    
    // Check for video
    if (trimmed.includes('video only')) {
      const match = trimmed.match(videoRegex);
      if (match) {
        videoStreams.push({
          id: match[1],
          ext: match[2],
          resolution: match[3],
          fps: parseInt(match[4])
        });
      }
    }
  }
  
  return { audioStreams, videoStreams };
}
```

## Cookie Management Strategy

```javascript
class CookieManager {
  constructor(globalCookiesFile = null) {
    this.globalCookiesFile = globalCookiesFile;
    this.failedCookies = new Set(); // Track cookies that got 403'd
  }
  
  getCookiesArgs(videoConfig) {
    // Priority: video-specific > global > none
    const cookiesFile = videoConfig.cookies_file || this.globalCookiesFile;
    
    if (cookiesFile && !this.failedCookies.has(cookiesFile)) {
      return ['--cookies', cookiesFile];
    }
    
    return [];
  }
  
  markFailed(cookiesFile) {
    // Mark a cookies file as rate-limited
    this.failedCookies.add(cookiesFile);
  }
}
```

## Retry Logic

```javascript
async function downloadWithRetry(args, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeYtdlp(args);
      return { success: true, result };
    } catch (error) {
      if (attempt < maxRetries) {
        const waitSec = attempt * 3; // 3s, 6s, 9s
        await sleep(waitSec * 1000);
      } else {
        return { success: false, error: error.message };
      }
    }
  }
}
```

## Language Code Reference

| Code | Language | বাংলা নাম |
|------|----------|----------|
| bn | Bangla | বাংলা |
| hi | Hindi | হিন্দি |
| en | English | ইংরেজি |
| es | Spanish | স্প্যানিশ |
| fr | French | ফরাসি |
| de | German | জার্মান |
| ja | Japanese | জাপানি |
| ko | Korean | কোরিয়ান |
| zh-Hans | Chinese (Simplified) | চীনা (সরলীকৃত) |
| zh-Hant | Chinese (Traditional) | চীনা (ঐতিহ্যবাহী) |
| ar | Arabic | আরবি |
| ru | Russian | রাশিয়ান |
| pt | Portuguese | পর্তুগিজ |
| it | Italian | ইতালীয় |
| tr | Turkish | তুর্কি |
| th | Thai | থাই |
| vi | Vietnamese | ভিয়েতনামি |
| id | Indonesian | ইন্দোনেশীয় |
| pl | Polish | পোলিশ |
| ta | Tamil | তামিল |
| te | Telugu | তেলুগু |
| ml | Malayalam | মালায়ালাম |

## Environment Setup

### Required PATH additions:
```javascript
const BIN_DIR = path.resolve(__dirname, '..', 'bin');
const customEnv = {
  ...process.env,
  PATH: `${BIN_DIR};${process.env.PATH}`
};
```

This ensures yt-dlp can find deno.exe and node.exe for solving YouTube's JavaScript challenges.

## File Structure (Proposed)

```
mcp-tool/
├── index.js              # MCP Server entry point
├── package.json          # Dependencies
├── tools/
│   ├── check-deps.js     # check_dependencies tool
│   ├── list-formats.js   # list_formats tool
│   ├── download.js       # download_tracks tool
│   ├── batch.js          # batch_download tool
│   ├── update.js         # update_binaries tool
│   └── convert.js        # convert_audio tool
├── lib/
│   ├── format-parser.js  # yt-dlp output parser
│   ├── cookie-manager.js # Cookie rotation logic
│   ├── retry-handler.js  # Retry with backoff
│   └── output-organizer.js # Directory structure manager
├── examples/
│   ├── batch-download-example.json
│   ├── batch-download-example.csv
│   └── batch-download-example.txt
├── PRODUCT_BRIEF.md
├── ARCHITECTURE.md
├── EXISTING_CODEBASE.md
└── AI_BUILD_GUIDE.md
```
