import { spawn } from 'child_process';
import { BIN_DIR, YTDLP_PATH, getCustomEnv } from './binary-manager.js';
import { getOutputTemplate } from './output-organizer.js';

export async function executeYtdlp(args) {
    return new Promise((resolve, reject) => {
        const customEnv = getCustomEnv();
        const child = spawn(YTDLP_PATH, args, { env: customEnv });
        
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (exitCode) => {
            resolve({ stdout, stderr, exitCode });
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

export function buildBaseArgs() {
    return ['--extractor-args', 'youtube:player_client=default,web_embedded'];
}

export async function getVideoTitle(url, cookiesArgs = []) {
    const args = [...buildBaseArgs(), ...cookiesArgs, '--print', 'title', url];
    const { stdout, exitCode, stderr } = await executeYtdlp(args);
    if (exitCode !== 0) {
        console.error(`getVideoTitle failed: ${stderr}`);
        throw new Error(`Failed to get video title: ${stderr}`);
    }
    return stdout.trim();
}

export async function listFormats(url, cookiesArgs = []) {
    const args = [...buildBaseArgs(), ...cookiesArgs, '-F', url];
    const { stdout, exitCode, stderr } = await executeYtdlp(args);
    if (exitCode !== 0) {
        console.error(`listFormats failed: ${stderr}`);
        throw new Error(`Failed to list formats: ${stderr}`);
    }
    return stdout;
}

export function buildDownloadArgs(formatId, outputDir, audioFormat, options = {}) {
    const args = [
        ...buildBaseArgs(),
        '-f', formatId,
        '-P', outputDir,
        '-o', getOutputTemplate(),
        '--ffmpeg-location', BIN_DIR
    ];

    if (audioFormat !== 'm4a') {
        args.push('--extract-audio', '--audio-format', audioFormat, '--audio-quality', '0');
    }

    if (options.subtitles) {
        args.push('--write-subs');
    }

    if (options.mergeFormat) {
        args.push('--merge-output-format', options.mergeFormat);
    }
    
    if (options.cookiesArgs) {
        args.push(...options.cookiesArgs);
    }

    if (options.url) {
        args.push(options.url);
    }

    return args;
}
