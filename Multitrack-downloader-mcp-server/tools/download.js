import path from 'path';
import { fileURLToPath } from 'url';
import { listFormats, getVideoTitle, executeYtdlp, buildDownloadArgs, buildBaseArgs } from '../lib/yt-dlp-executor.js';
import { parseFormats, filterByLanguages, selectBestPerLanguage } from '../lib/format-parser.js';
import { CookieManager } from '../lib/cookie-manager.js';
import { buildOutputDir, ensureDir } from '../lib/output-organizer.js';
import { executeWithRetry, sleep } from '../lib/retry-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_SERVER_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DOWNLOAD_DIR = path.join(MCP_SERVER_ROOT, 'Downloads');

export async function handleDownloadTracks({ 
  url, 
  download_type = 'audio_only', 
  languages = ['all'], 
  audio_format = 'mp3', 
  audio_quality = 'best',
  video_quality = 'best', 
  video_format, 
  subtitles, 
  output_dir, 
  cookies_file, 
  max_retries = 3 
}) {
  try {
    // Resolve output directory to absolute path
    const resolvedOutputDir = path.resolve(output_dir || DEFAULT_DOWNLOAD_DIR);
    console.error(`Output directory: ${resolvedOutputDir}`);

    const cookieManager = new CookieManager(cookies_file);
    const cookiesArgs = cookieManager.getCookiesArgs();

    console.error(`Starting download process for: ${url}`);

    // Step 1: Get formats and title
    const rawOutput = await listFormats(url, cookiesArgs);
    const title = await getVideoTitle(url, cookiesArgs);
    const parsedFormats = parseFormats(rawOutput);

    const result = {
      success: true,
      title,
      downloaded_files: [],
      failed_tracks: [],
      total_downloaded: 0,
      total_size_mb: 0
    };

    // Step 2: Audio downloads
    if (download_type === 'audio_only' || download_type === 'video_with_audio' || download_type === 'video_with_all_audio') {
      const filteredStreams = filterByLanguages(parsedFormats.audioStreams, languages);
      console.error(`Found ${filteredStreams.length} matching audio streams (before quality filter).`);

      // Apply quality selection — default 'best' selects only 1 track per language
      const audioStreams = selectBestPerLanguage(filteredStreams, audio_quality);
      console.error(`Selected ${audioStreams.length} audio streams after quality filter (${audio_quality}).`);

      if (audioStreams.length === 0) {
        console.error(`No audio streams found for languages: ${languages.join(', ')}`);
        result.failed_tracks.push({ language: languages.join(', '), error: 'No matching audio tracks found' });
      }

      for (const stream of audioStreams) {
        const trackOutputDir = buildOutputDir(resolvedOutputDir, title, audio_format);
        await ensureDir(trackOutputDir);
        
        const downloadResult = await executeWithRetry(async () => {
          const args = [
            ...buildBaseArgs(),
            ...cookiesArgs,
            '-f', stream.id,
            '-P', trackOutputDir,
            '-o', '[%(language|na)s] %(title)s [f%(format_id)s].%(ext)s',
            '--ffmpeg-location', (await import('../lib/binary-manager.js')).BIN_DIR,
          ];

          // Add audio extraction args if needed
          if (audio_format !== 'm4a') {
            args.push('--extract-audio', '--audio-format', audio_format, '--audio-quality', '0');
          }

          args.push(url);
          const { stdout, stderr, exitCode } = await executeYtdlp(args);
          
          if (exitCode !== 0) {
            throw new Error(`yt-dlp exited with code ${exitCode}: ${stderr}`);
          }
          
          return { stdout, stderr };
        }, max_retries);

        if (downloadResult.success) {
          result.total_downloaded++;
          result.downloaded_files.push({
            path: trackOutputDir,
            language: stream.language,
            language_name: stream.language_name,
            format: audio_format,
            format_id: stream.id,
            size_mb: 0
          });
          console.error(`✓ Downloaded: [${stream.language}] ${stream.language_name}`);
        } else {
          result.failed_tracks.push({ 
            format_id: stream.id, 
            language: stream.language, 
            error: downloadResult.error 
          });
          console.error(`✗ Failed: [${stream.language}] ${stream.language_name} - ${downloadResult.error}`);
        }

        // Delay between downloads to avoid rate limiting
        if (audioStreams.indexOf(stream) < audioStreams.length - 1) {
          await sleep(1500);
        }
      }
    }

    // Step 3: Video downloads
    if (download_type === 'video_with_audio' || download_type === 'video_only' || download_type === 'video_with_all_audio') {
      const videoOutputDir = buildOutputDir(resolvedOutputDir, title, 'video');
      await ensureDir(videoOutputDir);
      
      const vFormat = video_format || 'mkv';

      // Build video quality selector based on video_quality parameter
      let videoSelector;
      if (video_quality === 'best' || !video_quality) {
        videoSelector = 'bestvideo';
      } else {
        const qualityMap = {
          '2160p': 2160, '1440p': 1440, '1080p': 1080,
          '720p': 720, '480p': 480, '360p': 360
        };
        const height = qualityMap[video_quality];
        videoSelector = height ? `bestvideo[height<=${height}]` : 'bestvideo';
      }

      let formatArg;
      if (download_type === 'video_only') {
        formatArg = videoSelector;
      } else {
        formatArg = `${videoSelector}+bestaudio/best`;
      }

      console.error(`Video format selection: ${formatArg}`);

      const downloadResult = await executeWithRetry(async () => {
        const args = [
          ...buildBaseArgs(),
          ...cookiesArgs,
          '-f', formatArg,
          '--merge-output-format', vFormat,
          '-P', videoOutputDir,
          '-o', '[%(language|na)s] %(title)s [f%(format_id)s].%(ext)s',
          '--ffmpeg-location', (await import('../lib/binary-manager.js')).BIN_DIR,
          url
        ];

        const { stdout, stderr, exitCode } = await executeYtdlp(args);
        if (exitCode !== 0) {
          throw new Error(`yt-dlp video download exited with code ${exitCode}: ${stderr}`);
        }
        return { stdout, stderr };
      }, max_retries);

      if (downloadResult.success) {
        result.total_downloaded++;
        result.downloaded_files.push({
          path: videoOutputDir,
          language: 'video',
          format: vFormat,
          size_mb: 0
        });
        console.error(`✓ Downloaded video`);
      } else {
        result.failed_tracks.push({ language: 'video', error: downloadResult.error });
        result.success = false;
      }
    }

    // If any audio tracks failed but some succeeded, mark as partial success
    if (result.failed_tracks.length > 0 && result.total_downloaded > 0) {
      result.success = true; // partial success
    } else if (result.failed_tracks.length > 0 && result.total_downloaded === 0) {
      result.success = false;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    console.error('Error in download handler:', error);
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }]
    };
  }
}
