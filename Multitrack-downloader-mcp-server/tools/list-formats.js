import { listFormats, getVideoTitle } from '../lib/yt-dlp-executor.js';
import { parseFormats } from '../lib/format-parser.js';
import { CookieManager } from '../lib/cookie-manager.js';

export async function handleListFormats({ url, cookies_file }) {
  try {
    const cookieManager = new CookieManager(cookies_file);
    const cookiesArgs = cookieManager.getCookiesArgs();

    console.error(`Fetching formats for: ${url}`);
    
    const rawOutput = await listFormats(url, cookiesArgs);
    const title = await getVideoTitle(url, cookiesArgs);

    const parsed = parseFormats(rawOutput);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          title,
          video_streams: parsed.videoStreams,
          audio_streams: parsed.audioStreams
        }, null, 2)
      }]
    };
  } catch (error) {
    console.error('Error listing formats:', error);
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }]
    };
  }
}
