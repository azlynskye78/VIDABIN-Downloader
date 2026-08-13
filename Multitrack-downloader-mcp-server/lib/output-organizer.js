import path from 'path';
import fs from 'fs/promises';

export function sanitizeTitle(title) {
    if (!title) return 'untitled';
    return title
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
}

export function buildOutputDir(outputDir, videoTitle, format) {
    return path.join(outputDir, sanitizeTitle(videoTitle), format);
}

export function getOutputTemplate() {
    return '[%(language|na)s] %(title)s [f%(format_id)s].%(ext)s';
}

export async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        console.error(`Failed to create directory ${dirPath}:`, error.message);
        throw error;
    }
}
