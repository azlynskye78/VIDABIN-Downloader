# VIDABIN MCP Server — বিস্তারিত পরিকল্পনা

## সারসংক্ষেপ

আপনার VIDABIN Downloader টুলকে একটি **MCP (Model Context Protocol) Server**-এ রূপান্তর করা সম্পূর্ণ সম্ভব।  
এর মাধ্যমে AI Agent (Claude, Gemini, বা যেকোনো MCP-compatible AI) সরাসরি আপনার টুলের সব ফিচার ব্যবহার করতে পারবে — কোনো UI ছাড়াই।

---

## এটি কীভাবে কাজ করবে (Architecture)

```
আপনি (User)
    │
    ▼
AI Agent (Claude / Gemini / ChatGPT etc.)
    │  MCP Protocol
    ▼
VIDABIN MCP Server  ←── চলবে আপনার PC-তেই
    │
    ├── yt-dlp.exe
    ├── ffmpeg.exe
    └── Downloads/ ফোল্ডার
```

আপনি AI-কে বলবেন: _"এই ১০০টি ভিডিও থেকে বাংলা ও হিন্দি অডিও ট্র্যাক MP3 তে ডাউনলোড করো"_  
AI নিজে নিজে MCP টুল কল করে সব কাজ করবে। আপনাকে শুধু ফলাফল দেখাবে।

---

## MCP Server-এ যত টুল থাকবে (৬টি)

| টুল | কী করবে |
|-----|---------|
| `check_dependencies` | yt-dlp ও ffmpeg আছে কিনা চেক করবে |
| `list_formats` | যেকোনো YouTube URL-এর সব format/audio track দেখাবে |
| `download_item` | একটি নির্দিষ্ট format download করবে |
| `batch_download` | একটি JSON/YAML লিস্ট থেকে ১০০+ ভিডিও একসাথে process করবে |
| `update_binaries` | yt-dlp আপডেট করবে |
| `get_download_status` | চলমান download-এর progress দেখাবে |

---

## Input Document Format — AI-কে কী ফাইল দিতে হবে

### ✅ প্রস্তাবিত Format: JSON (সবচেয়ে নির্ভরযোগ্য)

```json
{
  "global_settings": {
    "output_dir": "D:\\Downloads\\VIDABIN",
    "audio_format": "mp3",
    "video_format": "mkv",
    "subtitles": "none",
    "max_retries": 3,
    "delay_between_downloads_sec": 5
  },
  "videos": [
    {
      "url": "https://www.youtube.com/watch?v=VIDEO_ID_1",
      "cookies_file": "cookies1.txt",
      "download_type": "audio_only",
      "languages": ["bn", "hi", "en"],
      "audio_format": "mp3",
      "note": "ভিডিও ১ — বাংলা ও হিন্দি অডিও চাই"
    },
    {
      "url": "https://www.youtube.com/watch?v=VIDEO_ID_2",
      "cookies_file": "cookies2.txt",
      "download_type": "video_with_audio",
      "languages": ["en"],
      "video_quality": "1080p",
      "subtitles": "all",
      "note": "ভিডিও ২ — সাথে সব subtitle"
    },
    {
      "url": "https://www.youtube.com/watch?v=VIDEO_ID_3",
      "cookies_file": null,
      "download_type": "audio_only",
      "languages": ["all"],
      "audio_format": "mp3",
      "note": "ভিডিও ৩ — সব ভাষার অডিও চাই"
    }
  ]
}
```

### প্রতিটি Field-এর মানে:

| Field | মান | মানে |
|-------|-----|------|
| `download_type` | `audio_only` | শুধু অডিও ট্র্যাক |
| | `video_only` | শুধু ভিডিও (অডিও ছাড়া) |
| | `video_with_audio` | ভিডিও + অডিও merge করে |
| | `all_audio_tracks` | সব ভাষার অডিও আলাদা আলাদা |
| `languages` | `["bn", "hi"]` | শুধু বাংলা ও হিন্দি |
| | `["all"]` | সব ভাষা |
| | `["en"]` | শুধু ইংরেজি |
| `cookies_file` | `"cookies1.txt"` | কোন cookies file ব্যবহার করবে |
| | `null` | cookies ছাড়া download |
| `video_quality` | `"1080p"`, `"720p"`, `"best"` | ভিডিও কোয়ালিটি |
| `audio_format` | `"mp3"`, `"wav"`, `"m4a"` | অডিও output format |

---

## Cookies সমস্যার সমাধান — Multiple Cookies Strategy

YouTube একই IP থেকে অনেক download দেখলে block করতে পারে। এর সমাধান:

### পদ্ধতি ১: ভিডিও ভাগ করে আলাদা cookies
```json
{
  "videos": [
    {"url": "...", "cookies_file": "cookies_account1.txt"},
    {"url": "...", "cookies_file": "cookies_account2.txt"},
    {"url": "...", "cookies_file": "cookies_account3.txt"}
  ]
}
```

### পদ্ধতি ২: Delay দিয়ে পর্যায়ক্রমে
```json
{
  "global_settings": {
    "delay_between_downloads_sec": 10,
    "batch_size": 5
  }
}
```

AI নিজেই বুঝে rotation করবে।

---

## AI Agent-এ কীভাবে যুক্ত করবেন

### Claude Desktop (claude.json):
```json
{
  "mcpServers": {
    "vidabin": {
      "command": "node",
      "args": ["D:\\MyAI\\Content create\\Multitrack Audio download\\mcp-server\\index.js"]
    }
  }
}
```

### Gemini / অন্য AI:
একইভাবে MCP configuration-এ path যুক্ত করতে হবে।

---

## Output Structure — ফোল্ডার কাঠামো

```
Downloads/
└── VIDABIN/
    ├── Video Title 1/
    │   ├── mp3/
    │   │   ├── [bn] Video Title 1 [f251-11].mp3   ← বাংলা
    │   │   ├── [hi] Video Title 1 [f251-2].mp3    ← হিন্দি
    │   │   └── [en] Video Title 1 [f251-21].mp3   ← English
    │   └── mkv/
    │       └── Video Title 1 [f137+251-21].mkv
    └── Video Title 2/
        └── mp3/
            └── [en] Video Title 2 [f251].mp3
```

---

## Proposed Changes — কী কী ফাইল তৈরি হবে

### নতুন ফাইল: `mcp-server/` ফোল্ডার

#### [NEW] mcp-server/index.js
MCP Server-এর মূল ফাইল। সব ৬টি টুল এখানে define হবে।

#### [NEW] mcp-server/package.json
MCP SDK dependency সহ package config।

#### [NEW] mcp-server/batch-processor.js
Batch download logic — JSON লিস্ট পড়ে পর্যায়ক্রমে download করে।

#### [NEW] mcp-server/format-detector.js
yt-dlp output parse করে language-specific format ID খুঁজে বের করে।

#### [NEW] example-batch.json
Example input document — AI-কে কীভাবে ফাইল দিতে হয় তার template।

---

## Open Questions — আপনার মতামত দরকার

> [!IMPORTANT]
> **প্রশ্ন ১:** MCP Server কোথায় চলবে?
> - (A) আপনার এই একই PC-তে (start.bat-এর মতো আলাদা একটি .bat চালাবেন)
> - (B) আলাদা কোনো server

> [!IMPORTANT]
> **প্রশ্ন ২:** কোন AI Agent ব্যবহার করবেন?
> - (A) Claude Desktop (Anthropic)
> - (B) Gemini / Google AI Studio
> - (C) অন্য কিছু (কোনটি?)

> [!IMPORTANT]
> **প্রশ্ন ৩:** Batch download-এ AI নিজে format ID বেছে নেবে, নাকি আপনি নির্দিষ্ট করে দেবেন?
> - (A) AI নিজে সবচেয়ে ভালো format বেছে নেবে
> - (B) আমি language code দিলে AI সেই language-এর format ID খুঁজে download করবে

---

## Verification Plan

1. একটি test URL দিয়ে `list_formats` টুল কাজ করে কিনা দেখব
2. ২-৩টি URL-এর JSON file দিয়ে `batch_download` test করব
3. Multiple cookies file দিয়ে rotation কাজ করে কিনা verify করব
