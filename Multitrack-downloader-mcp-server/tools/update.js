import { promisify } from 'util';
import { exec } from 'child_process';
import { YTDLP_PATH, BIN_DIR, getCustomEnv } from '../lib/binary-manager.js';

const execAsync = promisify(exec);

export async function handleUpdateBinaries() {
  try {
    const env = getCustomEnv();
    
    console.error('Getting current yt-dlp version...');
    const { stdout: currentVerOut } = await execAsync(`"${YTDLP_PATH}" --version`, { env });
    const previousVersion = currentVerOut.trim();

    console.error('Updating yt-dlp...');
    await execAsync(`"${YTDLP_PATH}" -U`, { env });

    console.error('Getting new yt-dlp version...');
    const { stdout: newVerOut } = await execAsync(`"${YTDLP_PATH}" --version`, { env });
    const newVersion = newVerOut.trim();

    const updated = previousVersion !== newVersion;

    console.error('Attempting Deno update...');
    try {
      await execAsync(`powershell -Command "iwr https://deno.land/install.ps1 -useb | iex"`, { env, shell: 'powershell.exe' });
    } catch (denoErr) {
      console.error('Deno update via powershell failed (non-critical):', denoErr);
    }

    const result = {
      ytdlp: { previous_version: previousVersion, new_version: newVersion, updated },
      message: updated ? `yt-dlp updated from ${previousVersion} to ${newVersion}` : `yt-dlp is already up-to-date (${newVersion}).`
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    console.error('Error updating binaries:', error);
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }]
    };
  }
}
