import React from 'react';
import { Copy, CheckCircle } from 'lucide-react';

const CommandPreview = ({ url, selectedVideos, selectedAudios, options }) => {
  const [copied, setCopied] = React.useState(false);

  const getCommands = () => {
    if (!url) return ['yt-dlp ...'];

    const videosToUse = selectedVideos.length > 0 ? selectedVideos : [];
    const audiosToUse = selectedAudios.length > 0 ? selectedAudios : [];

    // If multiple videos selected, each video gets its own command (bulk mode)
    if (videosToUse.length > 1) {
      return videosToUse.map((vid, i) => {
        let formatString = '';
        if (audiosToUse.length > 0) {
          formatString = `"${vid}+${audiosToUse.join('+')}"`;
        } else {
          formatString = `"${vid}"`;
        }

        const args = ['yt-dlp', '-f', formatString];
        if (options.audioMultistreams && audiosToUse.length > 1) {
          args.push('--audio-multistreams');
        }
        if (options.format) args.push('--merge-output-format', options.format);
        if (options.outputDir) args.push('-P', `"${options.outputDir}"`);
        if (options.subtitles === 'all') args.push('--write-subs', '--all-subs');
        else if (options.subtitles === 'en') args.push('--write-subs', '--sub-langs', 'en.*');
        else if (options.subtitles === 'auto') args.push('--write-auto-subs');
        args.push(`"${url}"`);
        return `# Video ${i + 1}/${videosToUse.length} (Format: ${vid})\n${args.join(' ')}`;
      });
    }

    // Single video or audio-only
    let formatString = '';
    if (videosToUse.length === 1 && audiosToUse.length > 0) {
      formatString = `"${videosToUse[0]}+${audiosToUse.join('+')}"`;
    } else if (videosToUse.length === 1) {
      formatString = `"${videosToUse[0]}"`;
    } else if (audiosToUse.length > 0) {
      formatString = `"${audiosToUse.join('+')}"`;
    } else {
      formatString = 'bestvideo+bestaudio/best';
    }

    const args = ['yt-dlp', '-f', formatString];
    if (options.audioMultistreams) args.push('--audio-multistreams');
    if (options.format) args.push('--merge-output-format', options.format);
    if (options.outputDir) args.push('-P', `"${options.outputDir}"`);
    if (options.subtitles === 'all') args.push('--write-subs', '--all-subs');
    else if (options.subtitles === 'en') args.push('--write-subs', '--sub-langs', 'en.*');
    else if (options.subtitles === 'auto') args.push('--write-auto-subs');
    args.push(`"${url}"`);
    return [args.join(' ')];
  };

  const commands = getCommands();
  const fullCommandText = commands.join('\n\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullCommandText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-lg">
      <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
        <h3 className="font-semibold text-gray-200 flex items-center gap-2">
          Step 4: Command Preview
          {selectedVideos.length > 1 && (
            <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">
              {selectedVideos.length} bulk downloads
            </span>
          )}
        </h3>
        <button 
          onClick={handleCopy}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
        >
          {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto custom-scrollbar max-h-64 overflow-y-auto">
        <code className="text-sm font-mono text-green-400 whitespace-pre">
          {fullCommandText}
        </code>
      </div>
    </div>
  );
};

export default CommandPreview;
