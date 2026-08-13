# VIDABIN Voice Changer — Full Planning & Implementation Guide

**Version:** 2.0  
**Status:** Ready for Implementation  
**Language:** English  
**Companion Tool:** VIDABIN Multitrack Audio Downloader

---

## 1. Project Overview

### What is VIDABIN Voice Changer?

VIDABIN Voice Changer is a local web-based automation tool that takes a folder of multi-language dubbed audio tracks (downloaded via VIDABIN Multitrack Audio Downloader from YouTube) and bulk-converts all of them into a custom cloned voice using AI Voice APIs — fully automatically, without any manual per-file interaction.

### Core Workflow

```
Input Folder Path
    ↓
Tool scans all audio files automatically
    ↓
Sends each file sequentially to selected AI API
(ElevenLabs / Kits.AI / Resemble AI)
    ↓
Saves converted output files to Output Folder
    ↓
Done — no manual steps required
```

### Business Vision

Offer a premium dubbing service to YouTube content creators:
- Creator provides their Voice Clone ID (from ElevenLabs etc.)
- You run their downloaded dubbed audio tracks through VIDABIN Voice Changer
- Creator receives every language track spoken in **their own cloned voice**
- This scales to an AI-agent-driven MCP Server automation pipeline in the future

---

## 2. Input File Analysis

Files downloaded by VIDABIN Multitrack Audio Downloader follow this structure:

```
Downloads/
  {Video Title}/
    mp3/
      [bn] {Video Title} [f140-1].mp3        ← Bengali
      [de-DE] {Video Title} [f140-2].mp3     ← German
      [en-US] {Video Title} [f140-20].mp3    ← English (Original)
      [es-US] {Video Title} [f140-3].mp3     ← Spanish
      [fr-FR] {Video Title} [f140-4].mp3     ← French
      [hi] {Video Title} [f140-5].mp3        ← Hindi
      [id] {Video Title} [f140-6].mp3        ← Indonesian
      [ru] {Video Title} [f140-16].mp3       ← Russian
```

**Filename Pattern:** `[{language_code}] {video_title} [f{format_id}].{ext}`

The tool automatically parses language codes and filenames — no manual selection needed.

---

## 3. Automation Design Philosophy

> **Core Principle: Zero Manual Interaction After Setup**

The user provides only:
1. **Input Folder Path** — the folder containing all audio tracks
2. **Voice ID** — the target cloned voice identifier
3. **API Key** — saved once, reused automatically
4. **Provider** — ElevenLabs / Kits.AI / Resemble AI

After clicking "Start Bulk Conversion":
- Tool automatically scans the folder for all audio files
- Processes them one by one in sequence (bulk mode)
- Saves each converted file to the Output Folder automatically
- Shows real-time progress per file
- Retries failed files automatically (3 attempts)
- Reports final summary

**No checkboxes. No manual file selection. No per-file confirmation.**

---

## 4. Supported API Platforms

### 🔶 ElevenLabs — Highest Quality (Recommended)

| Property | Value |
|----------|-------|
| Type | Speech-to-Speech (synchronous) |
| Endpoint | `POST /v1/speech-to-speech/{voice_id}` |
| Auth | `xi-api-key: {API_KEY}` |
| Input | `multipart/form-data`: audio file + model_id + voice_settings |
| Model | `eleven_multilingual_sts_v2` (all languages) |
| Output | Streaming audio (mp3/pcm/ulaw) |
| Strength | Preserves emotion, timing, and delivery — only voice changes |
| Docs | https://elevenlabs.io/docs/api-reference/speech-to-speech/convert |
| Guide | https://elevenlabs.io/docs/eleven-api/guides/cookbooks/voice-changer |

### 🔷 Kits.AI — Budget-Friendly

| Property | Value |
|----------|-------|
| Type | Voice Conversion (asynchronous) |
| Endpoint | `POST https://arpeggi.io/api/kits/v1/voice-conversions` |
| Auth | `Authorization: Bearer {API_KEY}` |
| Input | `multipart/form-data`: soundFile + voiceModelId |
| Output | Async job → poll status → download URL |
| Flow | Submit → Get job ID → Poll `/voice-conversions/{id}` → Download |
| Strength | Affordable pricing, community voice models |
| Docs | https://docs.kits.ai/api-reference/api-endpoints/voice-conversion-api/fetch-voice-conversions |

### 🔴 Resemble AI — Enterprise Grade

| Property | Value |
|----------|-------|
| Type | Speech-to-Speech (asynchronous) |
| Endpoint | `POST /api/v2/speech-to-speech` |
| Auth | `Authorization: Token {API_KEY}` |
| Input | JSON body: audio_src + voice_uuid + project_uuid |
| Output | Async render → polling or webhook |
| Strength | High-fidelity cloning, enterprise reliability |
| Docs | https://docs.resemble.ai/voice-generation/speech-to-speech |

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        VIDABIN Voice Changer                             │
│                    Local Web App (Node.js + React)                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  STEP 1: Provider & API Key Configuration                        │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │    │
│  │  │ ElevenLabs   │ │   Kits.AI    │ │ Resemble AI  │            │    │
│  │  │   ● Active   │ │              │ │              │            │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘            │    │
│  │  API Key: [••••••••••••••••••••••]  [Validate Key]              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  STEP 2: Input & Voice Setup                                     │    │
│  │  Input Folder: [D:\...\Downloads\Video Title\mp3\]  [Browse]    │    │
│  │  Target Voice: [Rachel - Calm & Professional        ▼]          │    │
│  │  Output Folder: [.\VoiceChanged\elevenlabs\]        [Browse]    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  STEP 3: Folder Scan Preview (Auto)                              │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │ 📁 Found 8 audio files — All will be converted           │   │    │
│  │  │  [bn]    4 Workflows... [f140-1].mp3       ~20.8 MB      │   │    │
│  │  │  [de-DE] 4 Workflows... [f140-2].mp3       ~20.1 MB      │   │    │
│  │  │  [en-US] 4 Workflows... [f140-20].mp3      ~23.9 MB      │   │    │
│  │  │  [es-US] 4 Workflows... [f140-3].mp3       ~20.5 MB      │   │    │
│  │  │  [fr-FR] 4 Workflows... [f140-4].mp3       ~20.2 MB      │   │    │
│  │  │  [hi]    4 Workflows... [f140-5].mp3       ~20.5 MB      │   │    │
│  │  │  [id]    4 Workflows... [f140-6].mp3       ~20.2 MB      │   │    │
│  │  │  [ru]    4 Workflows... [f140-16].mp3      ~20.4 MB      │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  │  Estimated API Cost: ~$0.24  (ElevenLabs, 16 min total)         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │       [▶  Start Bulk Conversion — 8 Files]                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  STEP 4: Real-Time Conversion Progress                           │    │
│  │  Overall: ████████████░░░░░░░░░ 62%  (5/8 complete)            │    │
│  │                                                                   │    │
│  │  [bn]    ✓ Completed → saved in 18s                             │    │
│  │  [de-DE] ✓ Completed → saved in 16s                             │    │
│  │  [en-US] ✓ Completed → saved in 21s                             │    │
│  │  [es-US] ✓ Completed → saved in 17s                             │    │
│  │  [fr-FR] ✓ Completed → saved in 16s                             │    │
│  │  [hi]    ⟳ Converting... [Attempt 1/3]  ████████░░ 78%         │    │
│  │  [id]    ◌ Queued                                               │    │
│  │  [ru]    ◌ Queued                                               │    │
│  │                                                                   │    │
│  │  Live Log: ▐ [ElevenLabs] Uploading [hi] audio... (14.2MB)     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  STEP 5: Results                                                 │    │
│  │  ✅ 8/8 files converted successfully!                            │    │
│  │  Output: D:\...\VoiceChanged\elevenlabs\4 Workflows...\         │    │
│  │  [Open Output Folder]   [Convert Another Folder]                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Project Folder Structure

```
VIDABIN_Voice_Changer/
├── src/
│   ├── App.jsx                      ← Main app shell
│   ├── main.jsx
│   ├── index.css                    ← Global dark theme styles
│   └── components/
│       ├── ProviderSelector.jsx     ← ElevenLabs / Kits.AI / Resemble tabs
│       ├── APIKeyManager.jsx        ← Key input, validate, save to config
│       ├── FolderScanner.jsx        ← Path input, scan, file preview list
│       ├── VoiceSelector.jsx        ← Dropdown from API voice list
│       ├── ConversionQueue.jsx      ← Bulk processor, SSE progress, retry
│       ├── ProgressPanel.jsx        ← Per-file status, overall progress bar
│       └── ResultPanel.jsx          ← Summary, open folder, re-run button
├── server.js                        ← Node.js Express backend (ES modules)
├── package.json
├── vite.config.js
├── index.html
├── config.json                      ← API keys stored locally (auto-created)
├── bin/
│   └── node.exe                     ← Portable Node.js runtime
├── VoiceChanged/                    ← Output directory (auto-created)
│   ├── elevenlabs/
│   ├── kitsai/
│   └── resembleai/
└── Launch_VIDABIN_VoiceChanger.bat  ← One-click launcher
```

---

## 7. Backend API Endpoints

```
server.js — All Endpoints:

POST /api/save-config           → Save API keys to config.json
GET  /api/load-config           → Load saved API keys
GET  /api/voices/elevenlabs     → Fetch voice list from ElevenLabs API
GET  /api/voices/kitsai         → Fetch voice models from Kits.AI
GET  /api/voices/resemble       → Fetch voice profiles from Resemble AI
POST /api/scan-folder           → Scan folder path, return audio file list
                                   with parsed language codes + file sizes
GET  /api/convert               → SSE endpoint: processes entire file queue
                                   automatically, streams per-file events
```

---

## 8. Conversion Queue Logic

```javascript
// Pseudocode — Full Automation Flow
async function runBulkConversion({ inputFolder, voiceId, apiKey, provider, outputFolder }) {

  // Step 1: Scan all audio files in folder
  const files = await scanFolder(inputFolder); // → [file1, file2, ...]

  // Step 2: Process each file sequentially
  for (const file of files) {
    let success = false;
    
    // Step 3: Retry logic (max 3 attempts)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        sendSSE('progress', { file: file.name, attempt, status: 'converting' });
        
        // Step 4: Call provider API
        const outputPath = buildOutputPath(outputFolder, provider, file);
        await convertWithProvider(provider, file.path, voiceId, apiKey, outputPath);
        
        sendSSE('progress', { file: file.name, status: 'done' });
        success = true;
        break;
      } catch (err) {
        if (attempt < 3) {
          sendSSE('log', `Attempt ${attempt} failed. Retrying in ${attempt * 3}s...`);
          await sleep(attempt * 3000);
        }
      }
    }
    
    if (!success) sendSSE('log', `❌ Skipping ${file.name} after 3 failed attempts`);
    await sleep(1500); // Brief pause between files
  }
  
  sendSSE('done', `Conversion complete: ${successCount}/${files.length} succeeded`);
}
```

---

## 9. Provider API Integration Code

### ElevenLabs (Synchronous)

```javascript
async function convertWithElevenLabs(inputPath, voiceId, apiKey, outputPath) {
  const formData = new FormData();
  formData.append('audio', fs.createReadStream(inputPath));
  formData.append('model_id', 'eleven_multilingual_sts_v2');
  formData.append('voice_settings', JSON.stringify({
    stability: 0.5,
    similarity_boost: 0.8,
    style: 0.0,
    use_speaker_boost: true
  }));

  const response = await fetch(
    `https://api.elevenlabs.io/v1/speech-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, ...formData.getHeaders() },
      body: formData
    }
  );

  if (!response.ok) throw new Error(`ElevenLabs API: ${response.status} ${response.statusText}`);
  
  const buffer = await response.buffer();
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, buffer);
}
```

### Kits.AI (Asynchronous with Polling)

```javascript
async function convertWithKitsAI(inputPath, voiceModelId, apiKey, outputPath) {
  // Submit job
  const form = new FormData();
  form.append('soundFile', fs.createReadStream(inputPath));
  form.append('voiceModelId', voiceModelId.toString());

  const submitRes = await fetch('https://arpeggi.io/api/kits/v1/voice-conversions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form
  });
  if (!submitRes.ok) throw new Error(`Kits.AI submit failed: ${submitRes.status}`);
  const { id } = await submitRes.json();

  // Poll for completion (max 10 minutes)
  const startTime = Date.now();
  while (Date.now() - startTime < 600000) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://arpeggi.io/api/kits/v1/voice-conversions/${id}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    const data = await statusRes.json();
    if (data.status === 'succeeded' && data.outputUrl) {
      const dlRes = await fetch(data.outputUrl);
      const buffer = await dlRes.buffer();
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, buffer);
      return;
    }
    if (data.status === 'failed') throw new Error('Kits.AI: Job failed');
  }
  throw new Error('Kits.AI: Timeout after 10 minutes');
}
```

---

## 10. Output File Organization

```
VoiceChanged/
  elevenlabs/
    4 Workflows You Can Use Today - Hermes Agent Prompts/
      [bn] 4 Workflows... [VOICE_Rachel].mp3
      [de-DE] 4 Workflows... [VOICE_Rachel].mp3
      [en-US] 4 Workflows... [VOICE_Rachel].mp3
      [es-US] 4 Workflows... [VOICE_Rachel].mp3
      [fr-FR] 4 Workflows... [VOICE_Rachel].mp3
      [hi] 4 Workflows... [VOICE_Rachel].mp3
      [id] 4 Workflows... [VOICE_Rachel].mp3
      [ru] 4 Workflows... [VOICE_Rachel].mp3
```

Output filenames preserve the original language code prefix for easy identification.

---

## 11. Future: MCP Server for AI Agent Automation

This tool is architected to become an MCP (Model Context Protocol) Server — allowing AI agents to trigger voice conversion workflows automatically.

### Future MCP Tools to Expose

```python
# MCP Server Tools (future implementation)

@mcp.tool()
def scan_audio_folder(folder_path: str) -> list[AudioFile]:
    """Scan a folder and return all audio files with metadata"""

@mcp.tool()
def convert_folder_bulk(
    input_folder: str,
    voice_id: str,
    provider: str = "elevenlabs",  # or "kitsai" / "resembleai"
    api_key: str = None,           # uses saved key if None
    output_folder: str = "./VoiceChanged"
) -> ConversionResult:
    """Bulk convert all audio files in a folder to target voice"""

@mcp.tool()
def get_available_voices(provider: str, api_key: str = None) -> list[Voice]:
    """Get list of available voice models from selected provider"""

@mcp.tool()
def get_conversion_status(job_id: str) -> JobStatus:
    """Check the status of an ongoing conversion job"""
```

### AI Agent Workflow (Future Vision)

```
User → AI Agent prompt:
"Convert all audio tracks in Downloads/Hermes Prompts/mp3/
 using Rachel voice on ElevenLabs"

AI Agent:
1. Calls scan_audio_folder("Downloads/Hermes Prompts/mp3/")
   → Returns: 8 files found
2. Calls convert_folder_bulk(
     input_folder="Downloads/Hermes Prompts/mp3/",
     voice_id="21m00Tcm4TlvDq8ikWAM",  ← Rachel's ID
     provider="elevenlabs"
   )
3. Monitors progress, reports completion
4. Returns: "8/8 files converted. Output saved to VoiceChanged/elevenlabs/"
```

This is why the backend is designed as clean RESTful endpoints — they map 1:1 to future MCP tools.

---

## 12. UI Design Specifications

### Visual Theme
- **Background:** Deep dark `#080a0f` with subtle gradient
- **Cards:** Glassmorphism — `rgba(255,255,255,0.03)` background, `1px solid rgba(255,255,255,0.08)` border, `backdrop-filter: blur(20px)`
- **Primary Accent:** Purple → Blue gradient (`#7c3aed → #2563eb`)
- **Success:** Emerald `#10b981`
- **Error/Retry:** Amber `#f59e0b`
- **Failure:** Red `#ef4444`

### Typography
- **Font:** Inter (Google Fonts)
- **Headings:** Bold, letter-spacing tight
- **Mono sections (logs, paths):** JetBrains Mono or Fira Code

### Key UI Components

#### Provider Cards
```
Three horizontal cards with hover glow effect:
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  🎤 ElevenLabs  │  │  🎵 Kits.AI     │  │  🔴 Resemble    │
│  ● Selected     │  │   Click to use  │  │   Click to use  │
│  Multilingual   │  │   Budget-friend │  │   Enterprise    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### Language Badge Display
```
[bn]     Bengali        ~20.8 MB    ~14 min
[de-DE]  German         ~20.1 MB    ~13 min
[en-US]  English (Org.) ~23.9 MB    ~16 min
```

#### Real-Time Terminal Log
```
Dark terminal panel (black background, green/white text):
> Scanning folder: D:\...\mp3\
> Found 8 audio files (total: 166.5 MB, ~112 min)
> Starting bulk conversion...
> [1/8] [bn] Uploading to ElevenLabs API...
> [1/8] [bn] Conversion complete → saved (18.3s)
> [2/8] [de-DE] Uploading to ElevenLabs API...
```

---

## 13. Challenges & Solutions

| Challenge | Solution |
|-----------|---------|
| Large file size (ElevenLabs ~25MB limit) | Detect size, split audio via FFmpeg if needed |
| Kits.AI async polling timeout | Max 10 min poll, graceful timeout with error |
| API key security | Store in local `config.json` only — never sent anywhere else |
| Language mismatch in voice quality | Use `eleven_multilingual_sts_v2` for all languages |
| Cost awareness | Calculate file duration → estimate cost before starting |
| Network interruption mid-conversion | Save progress state, resume from last completed file |

---

## 14. API Pricing Comparison (2025)

| Provider | Free Tier | Paid Plan | Approx. Cost/min | Best For |
|---------|-----------|-----------|------------------|---------|
| ElevenLabs | 10 min/mo | $5–$22/mo | ~$0.015/min | Quality work |
| Kits.AI | Limited | $9.99/mo | ~$0.008/min | Bulk processing |
| Resemble AI | Trial | $0.006/sec | ~$0.36/min | Enterprise clients |

**Recommendation:** Start with ElevenLabs for quality, use Kits.AI for high-volume bulk jobs.

---

## 15. Tech Stack

```json
{
  "backend": {
    "runtime": "Node.js 20 (portable)",
    "framework": "Express.js (ES Modules)",
    "key_packages": ["express", "cors", "form-data", "node-fetch", "multer"]
  },
  "frontend": {
    "framework": "React 18 + Vite",
    "styling": "Vanilla CSS (dark glassmorphism theme)",
    "fonts": ["Inter", "JetBrains Mono"]
  },
  "deployment": {
    "type": "Portable Windows app",
    "launcher": "Launch_VIDABIN_VoiceChanger.bat",
    "requires": "No system installation"
  }
}
```

---
---
---


