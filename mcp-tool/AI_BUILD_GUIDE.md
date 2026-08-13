# AI Build Guide — VIDABIN MCP Server তৈরির নির্দেশিকা

এই ডকুমেন্টটি AI Agent-কে VIDABIN MCP Server তৈরি করতে সাহায্য করবে।

---

## 📋 Step-by-Step Build Process

### ধাপ ১: ডকুমেন্ট পড়ুন
নিচের ফাইলগুলো পর্যায়ক্রমে পড়ুন:
1. `mcp-tool/PRODUCT_BRIEF.md` — প্রোডাক্ট রিকোয়ারমেন্ট (PRD)
2. `mcp-tool/ARCHITECTURE.md` — আর্কিটেকচার ও টেকনিক্যাল রেফারেন্স
3. `mcp-tool/EXISTING_CODEBASE.md` — বর্তমান কোডবেসের রেফারেন্স
4. `mcp-tool/examples/` — Input format-এর উদাহরণ
5. `server.js` — বর্তমান Express server (core logic এখান থেকে নেওয়া হবে)

### ধাপ ২: MCPize Idea Skill ব্যবহার করুন
- `/mcpize:idea` slash command বা MCPize Idea skill ব্যবহার করুন
- এই PRD থেকে একটি validated brief তৈরি করুন
- Competitor analysis করুন (yt-dlp MCP servers আছে কিনা)
- Monetization model ঠিক করুন

### ধাপ ৩: MCPize Build Skill ব্যবহার করুন
- `/mcpize:build` slash command বা MCPize Build skill ব্যবহার করুন
- Brief থেকে MCP server scaffold করুন
- সব ৬টি tool implement করুন
- Test লিখুন

### ধাপ ৪: MCPize Publish Skill ব্যবহার করুন
- `/mcpize:publish` slash command বা MCPize Publish skill ব্যবহার করুন
- Quality checks চালান
- Marketplace-এ publish করুন

---

## 🔑 Critical Technical Decisions (অবশ্যই মানতে হবে)

### 1. YouTube Player Client
```javascript
// ✅ সঠিক — সব dubbed audio track পাওয়া যায়
'--extractor-args', 'youtube:player_client=default,web_embedded'

// ❌ ভুল — SABR/DRM restriction, audio track লুকিয়ে যায়
'--extractor-args', 'youtube:player_client=tv,web'
```

### 2. Binary Execution Environment
```javascript
// bin/ ফোল্ডার PATH-এ যোগ করা বাধ্যতামূলক
const BIN_DIR = path.resolve(__dirname, '..', 'bin');
const customEnv = {
  ...process.env,
  PATH: `${BIN_DIR};${process.env.PATH}`
};

// সব child process-এ customEnv ব্যবহার করতে হবে
spawn(YTDLP_PATH, args, { env: customEnv });
execAsync(cmd, { env: customEnv });
```

### 3. Audio Conversion
```javascript
// m4a ছাড়া অন্য format-এ convert করতে:
if (audioFormat !== 'm4a') {
  args.push('--extract-audio', '--audio-format', audioFormat, '--audio-quality', '0');
}
// --audio-quality 0 মানে সর্বোচ্চ quality
```

### 4. Output Template
```javascript
args.push('-o', '[%(language|na)s] %(title)s [f%(format_id)s].%(ext)s');
// Output: [bn] Video Title [f251-11].mp3
```

### 5. Output Directory Structure
```javascript
// outputDir / sanitized_title / format/
const safeTitle = videoTitle
  .replace(/[<>:"/\\|?*]/g, '_')
  .replace(/\s+/g, ' ')
  .trim()
  .substring(0, 200);

const finalDir = path.join(outputDir, safeTitle, audioFormat);
args.push('-P', finalDir);
```

### 6. FFmpeg Location
```javascript
// yt-dlp-কে বলতে হবে FFmpeg কোথায় আছে
args.push('--ffmpeg-location', path.join(__dirname, '..', 'bin'));
```

---

## 🧪 Testing Checklist

### Basic Tests
- [ ] `check_dependencies` returns all binaries as available
- [ ] `list_formats` returns structured audio/video streams for a test URL
- [ ] `list_formats` shows multiple language audio tracks (not just English)
- [ ] `download_tracks` downloads a single audio track as MP3
- [ ] `download_tracks` downloads multiple language tracks for one video
- [ ] `download_tracks` downloads video + selected audio tracks merged

### Batch Tests
- [ ] `batch_download` processes 3+ videos from inline JSON config
- [ ] `batch_download` uses different cookies for different videos
- [ ] `batch_download` retries failed downloads up to max_retries
- [ ] `batch_download` adds delay between downloads
- [ ] `batch_download` returns comprehensive results summary

### Edge Cases
- [ ] Video with no dubbed tracks (only original audio)
- [ ] Invalid URL returns clear error
- [ ] Expired/invalid cookies handled gracefully
- [ ] 403 error triggers retry with backoff
- [ ] Very long video title is truncated for filesystem

---

## 📝 Example AI Prompts (MCP টুল তৈরির পর ব্যবহারকারী যেভাবে AI-কে বলবেন)

### প্রম্পট ১: Simple Audio Download
```
এই ভিডিও থেকে বাংলা ও হিন্দি অডিও MP3 তে ডাউনলোড করো:
https://www.youtube.com/watch?v=pAnGwRiQ4-4
```

### প্রম্পট ২: Batch Download with Languages
```
নিচের ৫টি ভিডিও থেকে বাংলা, হিন্দি ও ইংরেজি অডিও ট্র্যাক MP3 তে ডাউনলোড করো।
কুকি ফাইল: D:\cookies\main.txt
আউটপুট: D:\Downloads\Project-X

https://youtube.com/watch?v=AAA
https://youtube.com/watch?v=BBB
https://youtube.com/watch?v=CCC
https://youtube.com/watch?v=DDD
https://youtube.com/watch?v=EEE
```

### প্রম্পট ৩: Full Batch with Different Cookies
```
এই ভিডিওগুলো ডাউনলোড করো। প্রতিটির জন্য আলাদা cookie ব্যবহার করো:

1. https://youtube.com/watch?v=AAA (cookie: D:\cookies\client1.txt, ভাষা: bn,hi)
2. https://youtube.com/watch?v=BBB (cookie: D:\cookies\client2.txt, ভাষা: all)
3. https://youtube.com/watch?v=CCC (cookie: D:\cookies\client3.txt, ভাষা: en,bn)

সব MP3 তে ডাউনলোড হবে, আউটপুট D:\Downloads\Batch1
```

### প্রম্পট ৪: Video + Audio
```
এই ভিডিওটি 1080p MKV তে ডাউনলোড করো, সাথে সব ভাষার অডিও ট্র্যাক merge করো:
https://youtube.com/watch?v=XYZ
```

### প্রম্পট ৫: Excel/CSV File
```
এই CSV ফাইলে ১০০টি ভিডিওর তথ্য আছে। সব ডাউনলোড করো:
D:\projects\video-list.csv
```

---

## 🔗 Key File Paths

| What | Path |
|------|------|
| Project Root | `d:\MyAI\Content create\Multitrack Audio download\` |
| Existing Server | `d:\MyAI\Content create\Multitrack Audio download\server.js` |
| Binaries | `d:\MyAI\Content create\Multitrack Audio download\bin\` |
| MCP Tool Source | `d:\MyAI\Content create\Multitrack Audio download\mcp-tool\` |
| Product Brief | `d:\MyAI\Content create\Multitrack Audio download\mcp-tool\PRODUCT_BRIEF.md` |
| Architecture | `d:\MyAI\Content create\Multitrack Audio download\mcp-tool\ARCHITECTURE.md` |
| Existing Codebase | `d:\MyAI\Content create\Multitrack Audio download\mcp-tool\EXISTING_CODEBASE.md` |
| Examples | `d:\MyAI\Content create\Multitrack Audio download\mcp-tool\examples\` |

---

## ⚠️ Common Mistakes to Avoid

1. **`player_client=tv` ব্যবহার করবেন অ্যাকা** — YouTube SABR/DRM দিয়ে block করে
2. **PATH-এ bin/ যোগ করতে ভুলবেন না** — deno.exe না পেলে JS challenge solve হয় না
3. **`--audio-quality 0` দিতে ভুলবেন না** — ছাড়া দিলে quality কমে যায়
4. **MKV ব্যবহার করুন multi-audio merge-এ** — MP4 container multiple audio support করে না ভালোভাবে
5. **Title sanitize করুন** — `<>:"/\|?*` character ফাইলনামে ব্যবহার করা যায় না
6. **Delay দিন batch download-এ** — না দিলে YouTube 429/403 দেয়
