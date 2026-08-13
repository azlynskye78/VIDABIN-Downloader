import fs from 'fs/promises';
import { handleDownloadTracks } from './download.js';
import { sleep } from '../lib/retry-handler.js';

export async function handleBatchDownload({ batch_config, batch_file }) {
  try {
    let config = batch_config;
    if (batch_file) {
      const fileData = await fs.readFile(batch_file, 'utf8');
      config = JSON.parse(fileData);
    }

    if (!config || !Array.isArray(config.videos)) {
      throw new Error("Invalid batch configuration. 'videos' array is required.");
    }

    const globalSettings = config.global_settings || {};
    const delayBetween = globalSettings.delay_between_downloads_sec || 5;

    const batchResult = {
      total_videos: config.videos.length,
      completed: 0,
      failed: 0,
      results: [],
      total_files_downloaded: 0,
      total_size_mb: 0,
      output_directory: globalSettings.output_dir || '.\\Downloads'
    };

    for (let i = 0; i < config.videos.length; i++) {
      const videoInfo = config.videos[i];
      const url = typeof videoInfo === 'string' ? videoInfo : videoInfo.url;
      const overrides = typeof videoInfo === 'object' ? videoInfo : {};
      
      const mergedSettings = { ...globalSettings, ...overrides, url };

      console.error(`Batch processing [${i + 1}/${config.videos.length}]: ${url}`);

      try {
        const response = await handleDownloadTracks(mergedSettings);
        if (response.isError) {
          const errData = JSON.parse(response.content[0].text);
          batchResult.failed++;
          batchResult.results.push({ url, status: 'failed', error: errData.error });
        } else {
          const data = JSON.parse(response.content[0].text);
          batchResult.completed++;
          batchResult.results.push({
            url,
            title: data.title,
            status: data.success ? 'success' : 'partial',
            files_downloaded: data.total_downloaded
          });
          batchResult.total_files_downloaded += data.total_downloaded;
          batchResult.total_size_mb += data.total_size_mb || 0;
        }
      } catch (err) {
         console.error(`Batch item failed: ${url}`, err);
         batchResult.failed++;
         batchResult.results.push({ url, status: 'failed', error: err.message });
      }

      if (i < config.videos.length - 1) {
        console.error(`Waiting ${delayBetween}s before next download...`);
        await sleep(delayBetween * 1000);
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(batchResult, null, 2) }]
    };
  } catch (error) {
    console.error('Error in batch download:', error);
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }]
    };
  }
}
