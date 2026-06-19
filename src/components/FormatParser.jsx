import React, { useMemo } from 'react';

const FormatParser = ({ rawOutput, selectedVideos, setSelectedVideos, selectedAudios, setSelectedAudios }) => {
  const { videoFormats, audioFormats } = useMemo(() => {
    if (!rawOutput) return { videoFormats: [], audioFormats: [] };

    const lines = rawOutput.split('\n');
    const vFormats = [];
    const aFormats = [];

    let parsing = false;

    for (const line of lines) {
      if (line.includes('ID') && line.includes('EXT') && line.includes('RESOLUTION')) {
        parsing = true;
        continue;
      }
      if (parsing && line.startsWith('─')) {
        continue;
      }
      if (parsing && line.trim() !== '') {
        // Parse a format line. Example:
        // 234-0 m4a audio only      2 │    1.37MiB   49k https │ audio only          mp4a.40.5   49k 22k [fr] dubbed
        // 133 mp4   256x144    30    │    2.56MiB   92k https │ avc1.4d400c     92k video only          144p, mp4_dash
        const match = line.match(/^(\S+)\s+(\S+)\s+(.*?)(?:│|\|)(.*?)(?:│|\|)(.*)$/);

        if (match) {
          const id = match[1];
          const ext = match[2];
          const resFpsCh = match[3].trim();
          const sizeTbrProto = match[4].trim();
          const codecsInfo = match[5].trim();

          const formatObj = { id, ext, resFpsCh, sizeTbrProto, codecsInfo, raw: line };

          if (line.includes('audio only')) {
            aFormats.push(formatObj);
          } else if (!line.includes('images')) {
            vFormats.push(formatObj);
          }
        } else {
          // fallback if pipes are missing but it looks like a format
          const parts = line.split(/\s{2,}/);
          if (parts.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(parts[0])) {
            const id = parts[0];
            if (line.includes('audio only')) {
              aFormats.push({ id, ext: parts[1], raw: line });
            } else if (!line.includes('images')) {
              vFormats.push({ id, ext: parts[1], raw: line });
            }
          }
        }
      }
    }
    return { videoFormats: vFormats, audioFormats: aFormats };
  }, [rawOutput]);

  const toggleVideo = (id) => {
    if (selectedVideos.includes(id)) {
      setSelectedVideos(selectedVideos.filter(v => v !== id));
    } else {
      setSelectedVideos([...selectedVideos, id]);
    }
  };

  const toggleAudio = (id) => {
    if (selectedAudios.includes(id)) {
      setSelectedAudios(selectedAudios.filter(a => a !== id));
    } else {
      setSelectedAudios([...selectedAudios, id]);
    }
  };

  const selectAllVideos = () => {
    setSelectedVideos(videoFormats.map(f => f.id));
  };

  const deselectAllVideos = () => {
    setSelectedVideos([]);
  };

  const selectAllAudios = () => {
    setSelectedAudios(audioFormats.map(f => f.id));
  };

  const deselectAllAudios = () => {
    setSelectedAudios([]);
  };

  if (!rawOutput) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4 text-purple-400">Step 2: Select Formats</h3>

      <div className="bg-gray-900 p-4 rounded-lg mb-6 shadow-inner border border-gray-800">
        <h4 className="font-semibold mb-2">Raw Format Output</h4>
        <div className="overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
          <pre className="text-xs text-gray-400 font-mono whitespace-pre">{rawOutput}</pre>
        </div>
      </div>

      <div className="bg-yellow-900/30 border border-yellow-700/50 p-4 rounded-lg mb-6 text-yellow-200/90 text-sm flex gap-3 items-start">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="font-semibold text-yellow-500 mb-1">Always inspect format IDs first</p>
          <p>Plain yt-dlp downloads the wrong language ~70% of the time in 2025 for dubbed content. Select the specific video and audio tracks you want below.</p>
        </div>
      </div>

      {/* Bulk Download Info */}
      <div className="bg-emerald-900/20 border border-emerald-700/40 p-4 rounded-lg mb-6 text-emerald-200/90 text-sm flex gap-3 items-start">
        <span className="text-xl">🚀</span>
        <div>
          <p className="font-semibold text-emerald-400 mb-1">Bulk Download Mode</p>
          <p><strong>Videos:</strong> Select multiple video streams → each downloads separately in sequence.</p>
          <p className="mt-1"><strong>Audios:</strong> Uncheck "Enable Multi-Stream Audio Merging" in settings → select multiple audio tracks → each downloads independently as individual files. Perfect for dubbed audio tracks!</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Video Table */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-lg flex items-center gap-2">
              <span className="bg-purple-600/20 text-purple-400 p-1 rounded">🎬</span> Video Streams
              {selectedVideos.length > 0 && (
                <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                  {selectedVideos.length} selected
                </span>
              )}
            </h4>
            <div className="flex gap-2">
              <button
                onClick={selectAllVideos}
                className="text-xs bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 px-3 py-1 rounded-lg transition-colors border border-purple-500/30"
              >
                Select All
              </button>
              <button
                onClick={deselectAllVideos}
                className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg transition-colors border border-gray-600/30"
              >
                Deselect All
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="p-2 border-b border-gray-700">Select</th>
                  <th className="p-2 border-b border-gray-700">ID</th>
                  <th className="p-2 border-b border-gray-700">Res / FPS</th>
                  <th className="p-2 border-b border-gray-700">Info</th>
                </tr>
              </thead>
              <tbody>
                {videoFormats.map((fmt, idx) => {
                  const isSelected = selectedVideos.includes(fmt.id);
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer ${isSelected ? 'bg-purple-900/20 border-l-2 border-l-purple-500' : ''}`}
                      onClick={() => toggleVideo(fmt.id)}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          value={fmt.id}
                          checked={isSelected}
                          onChange={() => toggleVideo(fmt.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-600 focus:ring-2 accent-purple-500"
                        />
                      </td>
                      <td className="p-2 font-mono text-purple-300">{fmt.id}</td>
                      <td className="p-2">{fmt.resFpsCh || fmt.ext}</td>
                      <td className="p-2 text-xs text-gray-400 truncate max-w-xs" title={fmt.raw}>{fmt.codecsInfo || fmt.raw}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audio Table */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-lg flex items-center gap-2">
              <span className="bg-blue-600/20 text-blue-400 p-1 rounded">🎵</span> Audio Streams
              {selectedAudios.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                  {selectedAudios.length} selected
                </span>
              )}
            </h4>
            <div className="flex gap-2">
              <button
                onClick={selectAllAudios}
                className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1 rounded-lg transition-colors border border-blue-500/30"
              >
                Select All
              </button>
              <button
                onClick={deselectAllAudios}
                className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg transition-colors border border-gray-600/30"
              >
                Deselect All
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="p-2 border-b border-gray-700">Select</th>
                  <th className="p-2 border-b border-gray-700">ID</th>
                  <th className="p-2 border-b border-gray-700">Info / Lang</th>
                </tr>
              </thead>
              <tbody>
                {audioFormats.map((fmt, idx) => {
                  const isDubbed = fmt.id.includes('-');
                  const isSelected = selectedAudios.includes(fmt.id);
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer ${isDubbed ? 'bg-blue-900/10' : ''} ${isSelected ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : ''}`}
                      onClick={() => toggleAudio(fmt.id)}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          value={fmt.id}
                          checked={isSelected}
                          onChange={() => toggleAudio(fmt.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-600 focus:ring-2 accent-purple-500"
                        />
                      </td>
                      <td className="p-2 font-mono text-blue-300">
                        {fmt.id}
                        {isDubbed && <span className="ml-2 text-[10px] bg-blue-800 text-blue-200 px-1 py-0.5 rounded uppercase font-sans tracking-wider">Dubbed</span>}
                      </td>
                      <td className="p-2 text-xs text-gray-400 truncate max-w-xs" title={fmt.raw}>{fmt.codecsInfo || fmt.raw}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormatParser;
