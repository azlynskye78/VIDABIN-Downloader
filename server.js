import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Paths relative to the root
const YTDLP_PATH = '.\\bin\\yt-dlp.exe';
const FFMPEG_PATH = '.\\bin\\ffmpeg.exe';
const BIN_DIR = path.resolve(process.cwd(), 'bin');

// Add bin directory to PATH so yt-dlp can find deno.exe and node.exe for JS Challenges
const customEnv = {
  ...process.env,
  PATH: `${BIN_DIR};${process.env.PATH}`
};

async function getCookiesPath() {
  const possibleCookiePaths = [
    path.join(process.cwd(), 'cookies.txt'),
    path.join(process.cwd(), '..', 'cookies.txt')
  ];
  for (const p of possibleCookiePaths) {
    try {
      await fs.access(p);
      return p;
    } catch (e) {}
  }
  return null;
}

const buildAuthArgs = async (authMode, browserName) => {
  // FIXED (2026-07): YouTube's 'tv' client now uses SABR/DRM-like streaming
  // which hides multitrack dubbed audio. Using 'default,web_embedded' instead
  // restores full audio track discovery including all language dubs.
  const args = [
    '--extractor-args', 'youtube:player_client=default,web_embedded'
  ];
  
  if (authMode === 'browser' && browserName) {
    args.push('--cookies-from-browser', browserName);
  } else {
    // Default mode, check for cookies.txt
    const cookiesPath = await getCookiesPath();
    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }
  }
  
  return args;
};

// API 1: Check dependencies
app.get('/api/check-deps', async (req, res) => {
  let ytdlp = false;
  let ffmpeg = false;
  try {
    await execAsync(`"${YTDLP_PATH}" --version`);
    ytdlp = true;
  } catch (e) { }
  try {
    await execAsync(`"${FFMPEG_PATH}" -version`);
    ffmpeg = true;
  } catch (e) { }
  res.json({ ytdlp, ffmpeg });
});

// API 2: List formats
app.post('/api/list-formats', async (req, res) => {
  const { url, authMode, browserName } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const authArgs = await buildAuthArgs(authMode, browserName);
    
    // Construct command
    let cmd = `"${YTDLP_PATH}" ${authArgs.map(a => `"${a}"`).join(' ')} -F "${url}"`;
      
    const { stdout, stderr } = await execAsync(cmd, { env: customEnv });

    // Also fetch video title
    let title = '';
    try {
      const titleCmd = `"${YTDLP_PATH}" ${authArgs.map(a => `"${a}"`).join(' ')} --print title "${url}"`;
      const titleResult = await execAsync(titleCmd, { env: customEnv });
      title = titleResult.stdout.trim();
    } catch (e) {
      // Title fetch failed, not critical
    }

    res.json({ stdout, stderr, title });
  } catch (error) {
    res.status(500).json({ error: error.message, stdout: error.stdout, stderr: error.stderr });
  }
});

// API 3: Download (SSE)
app.get('/api/download', async (req, res) => {
  const url = req.query.url;
  const formatId = req.query.formatId;
  const outputDir = req.query.outputDir || '.\\Downloads';
  const format = req.query.format || 'mkv';
  const subtitles = req.query.subtitles || 'none';
  const audioMultistreams = req.query.audioMultistreams === 'true';
  const authMode = req.query.authMode || 'default';
  const browserName = req.query.browserName || '';
  const audioFormat = req.query.audioFormat || 'm4a';
  const itemType = req.query.itemType || 'mixed';
  const videoTitle = req.query.videoTitle || '';

  if (!url || !formatId) {
    return res.status(400).json({ error: 'URL and formatId are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const authArgs = await buildAuthArgs(authMode, browserName);
  const args = ['-f', formatId, ...authArgs];

  if (audioMultistreams) {
    args.push('--audio-multistreams');
  }

  // Output template
  args.push('-o', '[%(language|na)s] %(title)s [f%(format_id)s].%(ext)s');
  
  if (itemType === 'audio') {
    if (audioFormat !== 'm4a') {
      args.push('--extract-audio', '--audio-format', audioFormat, '--audio-quality', '0');
    }
  } else {
    args.push('--merge-output-format', format);
  }

  // Build output directory: outputDir / videoTitle / format
  let finalOutputDir = outputDir;
  if (videoTitle) {
    // Sanitize title for filesystem use
    const safeTitle = videoTitle.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 200);
    if (safeTitle) {
      finalOutputDir = path.join(outputDir, safeTitle);
    }
  }
  if (itemType === 'audio' && audioFormat) {
    finalOutputDir = path.join(finalOutputDir, audioFormat);
  } else if (itemType !== 'audio') {
    finalOutputDir = path.join(finalOutputDir, format);
  }

  if (finalOutputDir) {
    args.push('-P', finalOutputDir);
  }

  if (subtitles === 'all') {
    args.push('--write-subs', '--all-subs');
  } else if (subtitles === 'en') {
    args.push('--write-subs', '--sub-langs', 'en.*');
  } else if (subtitles === 'auto') {
    args.push('--write-auto-subs');
  }

  args.push('--ffmpeg-location', '.\\bin');
  args.push(url);

  const processChild = spawn(YTDLP_PATH, args, { env: customEnv });

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('info', `Running: yt-dlp ${args.join(' ')}\n`);

  processChild.stdout.on('data', (data) => {
    const text = data.toString();
    sendEvent('log', text);
  });

  processChild.stderr.on('data', (data) => {
    const text = data.toString();
    sendEvent('log', text);
  });

  processChild.on('close', (code) => {
    if (code === 0) {
      sendEvent('done', 'Download completed successfully. ✓');
    } else {
      sendEvent('error', `Process exited with code ${code}`);
    }
    res.end();
  });

  req.on('close', () => {
    processChild.kill();
  });
});

// API 4: Convert MP4 to MP3 in Downloads
app.get('/api/convert-mp4-to-mp3', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const downloadsDir = path.join(process.cwd(), 'Downloads');
  const mp3Dir = path.join(downloadsDir, 'mp3');

  try {
    await fs.access(downloadsDir);
  } catch {
    sendEvent('error', 'Downloads folder not found. Please download a video first.');
    return res.end();
  }

  try {
    await fs.mkdir(mp3Dir, { recursive: true });
  } catch (err) {
    sendEvent('error', `Failed to create mp3 directory: ${err.message}`);
    return res.end();
  }

  let files = [];
  try {
    files = await fs.readdir(downloadsDir);
  } catch (err) {
    sendEvent('error', `Failed to read directory: ${err.message}`);
    return res.end();
  }

  const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));
  if (mp4Files.length === 0) {
    sendEvent('done', 'No MP4 files found in Downloads folder.');
    return res.end();
  }

  sendEvent('info', `Found ${mp4Files.length} MP4 files to convert...`);

  let isClosed = false;
  req.on('close', () => { isClosed = true; });

  let successCount = 0;
  for (let i = 0; i < mp4Files.length; i++) {
    if (isClosed) break;
    const file = mp4Files[i];
    const inputPath = path.join(downloadsDir, file);
    const outputFileName = file.substring(0, file.lastIndexOf('.')) + '.mp3';
    const outputPath = path.join(mp3Dir, outputFileName);

    sendEvent('log', `[${i + 1}/${mp4Files.length}] Converting: ${file} ...`);

    try {
      await new Promise((resolve, reject) => {
        const process = spawn(FFMPEG_PATH, [
          '-i', inputPath,
          '-q:a', '0',
          '-map', 'a',
          outputPath,
          '-y'
        ]);

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`));
          }
        });
      });
      successCount++;
      sendEvent('log', `[${i + 1}/${mp4Files.length}] Success: ${outputFileName}`);
    } catch (err) {
      sendEvent('log', `[${i + 1}/${mp4Files.length}] Error converting ${file}: ${err.message}`);
    }
  }

  sendEvent('done', `Conversion complete. Successfully converted ${successCount} out of ${mp4Files.length} files.`);
  res.end();
});

// API 5: Update Binaries
app.get('/api/update-binaries', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('info', 'Starting update process for yt-dlp and deno...');

  try {
    sendEvent('log', 'Updating yt-dlp.exe...');
    const { stdout, stderr } = await execAsync(`"${YTDLP_PATH}" -U`);
    sendEvent('log', stdout.trim());
    if (stderr) sendEvent('log', stderr.trim());
  } catch (error) {
    sendEvent('log', `yt-dlp update check: ${error.message}`);
  }

  try {
    sendEvent('log', 'Updating deno.exe... (Downloading latest version)');
    const denoZipPath = path.join(BIN_DIR, 'deno.zip');
    const script = `
      Invoke-WebRequest -Uri 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip' -OutFile '${denoZipPath}';
      Expand-Archive -Path '${denoZipPath}' -DestinationPath '${BIN_DIR}' -Force;
      Remove-Item '${denoZipPath}';
    `;
    await execAsync(`powershell -Command "${script}"`);
    sendEvent('log', 'deno.exe updated successfully.');
  } catch (error) {
    sendEvent('log', `deno.exe update failed: ${error.message}`);
  }

  sendEvent('log', 'Note: node.exe and ffmpeg.exe rarely need updates and are currently in use. They have been skipped.');
  sendEvent('done', 'Update process finished.');
  res.end();
});

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`\n=================================================`);
  console.log(` VIDABIN Downloader Backend running on http://localhost:${PORT}`);
  console.log(`=================================================\n`);
  
  // Auto-open browser
  const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    exec(`${startCmd} http://localhost:${PORT}`);
  } catch (e) {
    console.log('Failed to auto-open browser.');
  }
});

