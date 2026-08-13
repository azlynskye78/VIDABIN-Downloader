import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { FFMPEG_PATH, getCustomEnv } from '../lib/binary-manager.js';

export async function handleConvertAudio({ source_dir, target_format = 'mp3', output_dir }) {
  try {
    const finalOutputDir = output_dir || path.join(path.dirname(source_dir), target_format);
    
    await fs.mkdir(finalOutputDir, { recursive: true });

    const files = await fs.readdir(source_dir);
    const audioExts = ['.m4a', '.webm', '.opus', '.wav', '.mp3', '.flac', '.aac', '.mp4'];
    
    const audioFiles = files.filter(f => audioExts.includes(path.extname(f).toLowerCase()));
    console.error(`Found ${audioFiles.length} audio files to convert.`);

    const result = {
      converted: 0,
      failed: 0,
      files: []
    };

    const env = getCustomEnv();

    for (const file of audioFiles) {
      const inputPath = path.join(source_dir, file);
      const ext = path.extname(file);
      const baseName = path.basename(file, ext);
      const outputPath = path.join(finalOutputDir, `${baseName}.${target_format}`);

      console.error(`Converting ${file} to ${target_format}...`);

      try {
        await new Promise((resolve, reject) => {
          const args = [
            '-i', inputPath,
            '-q:a', '0',
            '-map', 'a',
            '-y',
            outputPath
          ];
          
          const proc = spawn(FFMPEG_PATH, args, { env });
          
          proc.on('error', (err) => reject(err));
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg exited with code ${code}`));
          });
        });

        result.converted++;
        result.files.push({ source: inputPath, output: outputPath, status: 'success' });
      } catch (err) {
        console.error(`Failed to convert ${file}:`, err);
        result.failed++;
        result.files.push({ source: inputPath, status: 'failed', error: err.message });
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    console.error('Error in convert audio handler:', error);
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }]
    };
  }
}
