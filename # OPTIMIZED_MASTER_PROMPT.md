# OPTIMIZED MASTER PROMPT

> **How to use:** Open a new AI conversation, paste this entire prompt, and the agent will build the complete VIDABIN Voice Changer tool from scratch.

---

```
## ROLE & EXPERTISE

You are an expert full-stack developer specializing in:
- Node.js (Express, Server-Sent Events, file system automation)
- React + Vite (real-time UI, glassmorphism dark themes)
- AI API integrations (ElevenLabs, Kits.AI, Resemble AI — voice conversion)
- Portable Windows desktop app packaging (.bat launchers)
- Audio file processing and batch automation pipelines
- MCP Server architecture design

---

## PROJECT CONTEXT

I have an existing tool called "VIDABIN Multitrack Audio Downloader" — a local Node.js + React web app that:
1. Takes a YouTube URL
2. Uses yt-dlp to extract all dubbed audio tracks (multiple languages)
3. Bulk downloads them as separate MP3/WAV files
4. Saves them in an organized folder structure: `Downloads/{VideoTitle}/{format}/`

Example of downloaded files:
```
Downloads/
  4 Workflows You Can Use Today: Hermes Agent Prompts/
    mp3/
      [bn] 4 Workflows You Can Use Today: Hermes Agent Prompts [f140-1].mp3
      [de-DE] 4 Workflows You Can Use Today: Hermes Agent Prompts [f140-2].mp3
      [en-US] 4 Workflows You Can Use Today: Hermes Agent Prompts [f140-20].mp3
      [es-US] 4 Workflows You Can Use Today: Hermes Agent Prompts [f140-3].mp3
      [fr-FR] 4 Workflows You Can Use Today: Hermes Agent Prompts [f140-4].mp3
      [hi] 4 Workflows You Can Use Today: Hermes Agent Prompts [f140-5].mp3
      [id] 4 Workflows You Can Use Today: Hermes Agent Prompts [f140-6].mp3
      [ru] 4 Workflows You Can Use Today: Hermes Agent Prompts [f140-16].mp3
```

Filename format: `[{language_code}] {video_title} [f{format_id}].{ext}`

---

## THE TOOL I WANT YOU TO BUILD

**Tool Name:** VIDABIN Voice Changer

**Core Purpose:**
A fully automated bulk voice conversion tool. The user provides a folder path containing multi-language dubbed audio files, selects a target cloned voice and API provider, then clicks Start — and the tool automatically processes ALL audio files in that folder one by one, converts each to the target voice using the selected AI API, and saves all converted outputs to the output folder. Zero manual per-file interaction required.

**Automation Design Philosophy:**
- User inputs ONLY: input folder path + voice ID + API key (saved once)
- Tool scans the folder automatically — NO manual file selection or checkboxes
- Processes all found audio files sequentially in bulk mode
- Saves each converted file to output folder automatically
- Shows real-time per-file progress
- Retries failed files automatically before skipping

**Business Use Case:**
Offer a premium service to YouTube content creators — download all their dubbed language tracks using VIDABIN Multitrack Downloader, then convert every language version to their own cloned voice using VIDABIN Voice Changer. Deliver complete multi-language audio content in the creator's own voice.

**Future Vision:**
This tool will become the foundation for an MCP (Model Context Protocol) Server — allowing AI agents to trigger bulk voice conversion workflows autonomously with just a folder path + voice ID + provider prompt. The backend RESTful API design must be MCP-server-ready from day one.

---

## API PLATFORMS TO INTEGRATE

### 1. ElevenLabs — Primary (Highest Quality)
- Docs: https://elevenlabs.io/docs/api-reference/speech-to-speech/convert
- Guide: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/voice-changer
- Endpoint: POST https://api.elevenlabs.io/v1/speech-to-speech/{voice_id}
- Auth: Header `xi-api-key: {API_KEY}`
- Input: multipart/form-data (audio file + model_id + voice_settings JSON)
- Model to use: `eleven_multilingual_sts_v2` (supports ALL languages)
- Output: Direct audio stream (save to file)
- Key strength: Preserves original emotion, timing and delivery — only voice changes

### 2. Kits.AI — Budget Option
- Docs: https://docs.kits.ai/api-reference/api-endpoints/voice-conversion-api/fetch-voice-conversions
- Submit: POST https://arpeggi.io/api/kits/v1/voice-conversions
- Poll: GET https://arpeggi.io/api/kits/v1/voice-conversions/{id}
- Auth: Header `Authorization: Bearer {API_KEY}`
- Input: multipart/form-data (soundFile + voiceModelId)
- Flow: Submit → receive job ID → poll every 5s until status === 'succeeded' → download outputUrl
- Timeout: max 10 minutes polling

### 3. Resemble AI — Enterprise Option
- Docs: https://docs.resemble.ai/voice-generation/speech-to-speech
- Endpoint: POST /api/v2/speech-to-speech
- Auth: Header `Authorization: Token {API_KEY}`
- Input: JSON body with audio source + voice_uuid + project_uuid
- Flow: Async render → polling or webhook → download

**IMPORTANT:** Read all three documentation URLs thoroughly before writing any code.

---

## TECHNICAL SPECIFICATIONS

### Architecture
Same architecture as VIDABIN Multitrack Audio Downloader:
- Backend: Node.js Express server (`server.js`) using ES modules (`"type": "module"`)
- Frontend: React + Vite compiled to `dist/` folder
- Express serves `dist/` as static files (must implement `express.static` — no "Cannot GET /" error)
- Express catch-all route `app.get('*', ...)` serves index.html for SPA routing
- Runtime: Portable `bin/node.exe` (no system installation needed)
- Launcher: `Launch_VIDABIN_VoiceChanger.bat` opens server and auto-launches browser

### Backend API Endpoints to Build

```
POST /api/save-config
  Body: { provider: 'elevenlabs', apiKey: '...' }
  Action: Save to local config.json
  Returns: { success: true }

GET /api/load-config
  Returns: { elevenlabs: { apiKey: '...' }, kitsai: {...}, resemble: {...} }

GET /api/voices/elevenlabs?apiKey=xxx
  Returns: [{ voice_id, name, preview_url }, ...]

GET /api/voices/kitsai?apiKey=xxx
  Returns: [{ id, name }, ...]

GET /api/voices/resemble?apiKey=xxx
  Returns: [{ uuid, name }, ...]

POST /api/scan-folder
  Body: { folderPath: 'D:\\...\\mp3\\' }
  Action: Scan folder for .mp3/.wav/.m4a/.flac files
  Returns: [{
    filename: '[bn] Title [f140-1].mp3',
    fullPath: 'D:\\...\\[bn] Title [f140-1].mp3',
    languageCode: 'bn',
    size: 20799591,
    sizeFormatted: '19.8 MB'
  }, ...]

GET /api/convert (SSE — Server-Sent Events)
  Query params: inputFolder, voiceId, provider, apiKey, outputFolder
  Action:
    1. Scan inputFolder for all audio files
    2. For each file:
       a. Attempt conversion (max 3 retries with 3s/6s/9s backoff)
       b. On success: save to outputFolder/{provider}/{videoTitle}/
       c. Stream SSE events: progress, log, fileDone, error, done
  SSE event types:
    - { type: 'scan', data: { total, files } }
    - { type: 'log', data: 'message string' }
    - { type: 'fileStart', data: { index, total, filename, languageCode } }
    - { type: 'fileProgress', data: { percent } }  (if available)
    - { type: 'fileDone', data: { filename, outputPath, duration_ms } }
    - { type: 'fileError', data: { filename, attempt, error } }
    - { type: 'fileSkipped', data: { filename } }
    - { type: 'done', data: { successCount, failCount, total, outputFolder } }
```

### Frontend Components

```
App.jsx — Main container, step-based layout

ProviderSelector.jsx
  - Three card buttons: ElevenLabs | Kits.AI | Resemble AI
  - Active card shows glow/border highlight
  - Each card shows provider name, brief strength description, pricing tier badge

APIKeyManager.jsx
  - Password input field for API key
  - [Validate Key] button — calls GET /api/voices/... and shows ✅ or ❌
  - [Save Key] button — saves to config.json via POST /api/save-config
  - Auto-loads saved key on mount from GET /api/load-config

VoiceSelector.jsx
  - Dropdown populated after key validation
  - Shows voice name + voice ID
  - [Refresh Voices] button

FolderInput.jsx
  - Input: Input Folder Path (type it or paste)
  - [Scan Folder] button → calls POST /api/scan-folder
  - Shows scanned file count + total size + estimated API cost
  - File list preview: shows language badge + filename + size for each file
  - NO checkboxes — ALL files will be converted

OutputSettings.jsx
  - Input: Output Folder Path (default: ./VoiceChanged/{provider}/)
  - Output format display (inherits from input format)

ConversionQueue.jsx
  - [▶ Start Bulk Conversion — {N} Files] button (large, prominent, centered)
  - After click: opens SSE stream to /api/convert
  - Overall progress bar showing X/N completed
  - Per-file status rows:
    ✓ [bn] filename.mp3 — Done (18s)
    ⟳ [hi] filename.mp3 — Converting... Attempt 2/3
    ◌ [id] filename.mp3 — Queued
    ❌ [ru] filename.mp3 — Failed after 3 attempts
  - Live terminal log panel (dark background, mono font, auto-scroll)

ResultPanel.jsx
  - Shows only after conversion completes
  - Summary: "✅ 8/8 files converted successfully!"
  - Or: "⚠️ 6/8 converted. 2 failed after retries."
  - [📂 Open Output Folder] button
  - [🔄 Convert Another Folder] button (resets to Step 1)
```

---

## UI/UX DESIGN REQUIREMENTS (CRITICAL — Must Be Premium Quality)

### Color Palette
```css
--bg-primary:     #080a0f;     /* Deep dark base */
--bg-card:        rgba(255,255,255,0.03);
--border-card:    rgba(255,255,255,0.08);
--accent-purple:  #7c3aed;
--accent-blue:    #2563eb;
--accent-emerald: #10b981;
--accent-amber:   #f59e0b;
--accent-red:     #ef4444;
--text-primary:   #f1f5f9;
--text-secondary: #94a3b8;
--text-mono:      #a5f3fc;
```

### Card Style
```css
background: rgba(255,255,255,0.03);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 16px;
backdrop-filter: blur(20px);
box-shadow: 0 4px 24px rgba(0,0,0,0.4);
transition: border-color 0.2s, box-shadow 0.2s;
```

### Provider Card Active State
```css
border-color: rgba(124, 58, 237, 0.6);
box-shadow: 0 0 32px rgba(124, 58, 237, 0.2);
```

### Start Button
```css
background: linear-gradient(135deg, #7c3aed, #2563eb);
border-radius: 50px;
padding: 18px 60px;
font-size: 18px;
font-weight: 800;
box-shadow: 0 0 40px rgba(124, 58, 237, 0.35);
hover: scale(1.03), shadow increases
active: scale(0.97)
```

### Language Badge Colors
```
[en] / [en-US] → Blue   background: rgba(59,130,246,0.2) text: #93c5fd
[bn]           → Orange  background: rgba(251,146,60,0.2) text: #fdba74
[hi]           → Green   background: rgba(34,197,94,0.2)  text: #86efac
[de] / [de-DE] → Gray    background: rgba(148,163,184,0.2) text: #cbd5e1
[fr] / [fr-FR] → Violet  background: rgba(167,139,250,0.2) text: #c4b5fd
[es] / [es-US] → Red     background: rgba(248,113,113,0.2) text: #fca5a5
[id]           → Teal    background: rgba(20,184,166,0.2) text: #5eead4
[ru]           → Pink    background: rgba(236,72,153,0.2) text: #f9a8d4
```

### Typography
```
Body: Inter (Google Fonts)
Code/Paths/Logs: JetBrains Mono or Fira Code
Hero heading: 2.5rem, font-weight: 900
Step headings: 1.25rem, font-weight: 700
```

### Animations
- Card hover: subtle glow border-color transition
- Progress bar: smooth width transition with shimmer effect
- File status icons: spin animation for ⟳ (converting)
- Success ✓: fade-in green
- Page load: fade-up entrance animation for each step card

### App Header
```
VIDABIN VOICE CHANGER
[Gradient text: purple → blue]
Tagline: "Bulk Voice Clone Conversion for Multi-Language Audio"
Small version badge: v2.0
```

---

## STEP-BASED LAYOUT

Build the UI as a clean vertical step flow:

```
[HEADER — App name + tagline]

[STEP 1 — Select Provider]
  Three cards: ElevenLabs / Kits.AI / Resemble AI

[STEP 2 — API Configuration]
  API key input + validate + save

[STEP 3 — Select Target Voice]
  Dropdown from API + refresh button

[STEP 4 — Input & Output Setup]
  Input folder path + Scan button
  → File list preview (language badges, sizes)
  → Estimated cost display
  Output folder path

[START BUTTON — centered, large gradient CTA]

[STEP 5 — Live Conversion Progress]  (shows only after start)
  Overall progress bar
  Per-file status list
  Live terminal log

[STEP 6 — Results]  (shows only after completion)
  Summary + open folder + restart buttons
```

---

## RETRY & ERROR HANDLING

```javascript
// Per-file retry logic
const MAX_RETRIES = 3;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    await convertFile(...);
    successCount++;
    break; // success — move to next file
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const waitSec = attempt * 3; // 3s, 6s, 9s
      sendSSE('log', `Attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${waitSec}s...`);
      await sleep(waitSec * 1000);
    } else {
      sendSSE('fileSkipped', { filename });
      failCount++;
    }
  }
}
```

---

## OUTPUT FILE NAMING

```
Input:  [hi] Video Title [f140-5].mp3
Output: [hi] Video Title [VOICE_{voiceId_short}].mp3

Output folder structure:
VoiceChanged/
  {provider}/           ← e.g., elevenlabs/
    {video_title}/      ← parsed from input folder name
      [bn] ...mp3
      [hi] ...mp3
      ...
```

---

## LAUNCHER FILE (bat)

```batch
@echo off
title VIDABIN Voice Changer
echo =====================================================
echo   Starting VIDABIN Voice Changer
echo   Please wait... Do not close this window!
echo =====================================================
cd /d "%~dp0"
start "" "bin\node.exe" "app\server.js"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3002"
echo =====================================================
echo   VIDABIN Voice Changer is running!
echo   Open: http://localhost:3002
echo =====================================================
```

Use port 3002 to avoid conflict with VIDABIN Multitrack Downloader (port 3001).

---

## IMPLEMENTATION ORDER

Build in this exact sequence:
1. `package.json` — all dependencies
2. `server.js` — complete backend (all 6 endpoints)
3. `vite.config.js` — proxy config for dev mode
4. `index.html` — app shell
5. `src/index.css` — complete dark glassmorphism theme
6. `src/main.jsx`
7. `src/App.jsx` — step-based layout shell
8. All components one by one (in order listed above)
9. `Launch_VIDABIN_VoiceChanger.bat`
10. `npm run build` → verify dist serves correctly
11. Test complete flow with a real audio file and ElevenLabs API

---

## DELIVERABLES

1. Complete, production-ready codebase for VIDABIN Voice Changer
2. All three API integrations (ElevenLabs, Kits.AI, Resemble AI) fully implemented
3. Premium dark glassmorphism React UI — must look stunning on first load
4. Fully automated bulk conversion — no per-file manual interaction
5. Windows-compatible portable launcher (.bat file)
6. Retry mechanism with exponential backoff
7. MCP-server-ready RESTful backend architecture (clean endpoints)
8. API key persistence in local config.json
9. README with setup + API key acquisition guide

---

## IMPORTANT NOTES

- Port: Use 3002 (not 3001 — that is used by VIDABIN Multitrack Downloader)
- ES Modules: All backend code must use `import/export` (not `require`)
- Static serving: Express MUST serve `dist/` correctly (no "Cannot GET /")
- No cloud: API keys stored only in local config.json, never transmitted anywhere except the official provider API endpoint
- File size check: Before sending to ElevenLabs, check if file > 25MB — if so, log a warning
- Build tool: Vite (same as VIDABIN Multitrack Downloader)
```

---

## Reference Documents

- **VIDABIN Voice Changer Plan (this document):** Full architecture & design specification
- **ElevenLabs S2S API:** https://elevenlabs.io/docs/api-reference/speech-to-speech/convert
- **ElevenLabs Voice Changer Guide:** https://elevenlabs.io/docs/eleven-api/guides/cookbooks/voice-changer
- **Kits.AI Voice Conversion API:** https://docs.kits.ai/api-reference/api-endpoints/voice-conversion-api/fetch-voice-conversions
- **Resemble AI S2S:** https://docs.resemble.ai/voice-generation/speech-to-speech

---

*Document Version: 2.0 | Language: English | Ready for Implementation*
