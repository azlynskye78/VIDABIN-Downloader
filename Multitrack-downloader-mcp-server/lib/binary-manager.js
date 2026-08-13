import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BIN_DIR = path.resolve(__dirname, '../../bin');
export const YTDLP_PATH = path.join(BIN_DIR, 'yt-dlp.exe');
export const FFMPEG_PATH = path.join(BIN_DIR, 'ffmpeg.exe');

export function getCustomEnv() {
    return {
        ...process.env,
        PATH: `${BIN_DIR};${process.env.PATH}`
    };
}

export async function checkDependencies() {
    const customEnv = getCustomEnv();
    const result = {
        ytdlp: { available: false, version: null },
        ffmpeg: { available: false, version: null },
        deno: { available: false, version: null },
        node: { available: false, version: null }
    };

    try {
        const { stdout } = await execAsync(`"${YTDLP_PATH}" --version`, { env: customEnv });
        result.ytdlp.available = true;
        result.ytdlp.version = stdout.trim();
    } catch (err) {
        console.error('yt-dlp check failed:', err.message);
    }

    try {
        const { stdout } = await execAsync(`"${FFMPEG_PATH}" -version`, { env: customEnv });
        result.ffmpeg.available = true;
        result.ffmpeg.version = stdout.split('\n')[0].trim();
    } catch (err) {
        console.error('ffmpeg check failed:', err.message);
    }

    try {
        const { stdout } = await execAsync('deno --version', { env: customEnv });
        result.deno.available = true;
        result.deno.version = stdout.split('\n')[0].trim();
    } catch (err) {
        console.error('deno check failed:', err.message);
    }

    try {
        const { stdout } = await execAsync('node --version', { env: customEnv });
        result.node.available = true;
        result.node.version = stdout.trim();
    } catch (err) {
        console.error('node check failed:', err.message);
    }

    return result;
}
