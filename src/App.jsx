import React, { useState, useEffect, useRef } from 'react';
import { Download, Terminal, AlertTriangle, Link2, Folder, CheckCircle, ChevronDown, Repeat, ExternalLink, MonitorPlay, FileAudio, Info, PhoneCall, BookOpen, Layers } from 'lucide-react';
import FormatParser from './components/FormatParser';
import CommandPreview from './components/CommandPreview';
import TerminalLog from './components/TerminalLog';

function App() {
  const [url, setUrl] = useState('');
  const [fetchingFormats, setFetchingFormats] = useState(false);
  const [rawFormatOutput, setRawFormatOutput] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [deps, setDeps] = useState({ ytdlp: true, ffmpeg: true, checked: false });

  // Refs for scrolling
  const homeRef = useRef(null);
  const converterRef = useRef(null);
  const aboutRef = useRef(null);
  const tutorialRef = useRef(null);
  const contactRef = useRef(null);

  // Format Selection
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [selectedAudios, setSelectedAudios] = useState([]);

  // Options
  const [options, setOptions] = useState({
    format: 'mkv',
    outputDir: '.\\Downloads',
    subtitles: 'none',
    audioMultistreams: false,
    authMode: 'default',
    browserName: 'chrome',
    audioFormat: 'mp3'
  });

  // Download State
  const [isDownloading, setIsDownloading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  // Converter State
  const [isConverting, setIsConverting] = useState(false);
  const [convertLogs, setConvertLogs] = useState([]);
  const [convertStatusMsg, setConvertStatusMsg] = useState('');

  // Update State
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState([]);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');

  // Check dependencies on mount
  useEffect(() => {
    fetch('/api/check-deps')
      .then(res => res.json())
      .then(data => {
        setDeps({ ...data, checked: true });
      })
      .catch(err => {
        console.error("Failed to check dependencies", err);
        setDeps({ ytdlp: false, ffmpeg: false, checked: true });
      });
  }, []);

  // No longer auto-enable audioMultistreams — user decides merge vs bulk

  // Bulk download state
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentId: '' });

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFetchFormats = async () => {
    if (!url) return;
    setFetchingFormats(true);
    setRawFormatOutput('');
    setSelectedVideos([]);
    setSelectedAudios([]);

    try {
      const res = await fetch('/api/list-formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          authMode: options.authMode,
          browserName: options.browserName
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRawFormatOutput(data.stdout || data.stderr);
        // Store video title if returned by backend
        if (data.title) {
          setVideoTitle(data.title);
        }
      } else {
        setRawFormatOutput(`ERROR:\n${data.error}\n${data.stderr}`);
      }
    } catch (err) {
      setRawFormatOutput(`Network error: ${err.message}`);
    } finally {
      setFetchingFormats(false);
    }
  };

  // Download single format via SSE — rejects on error for retry logic
  const downloadSingle = (formatId, itemType = 'mixed') => {
    return new Promise((resolve, reject) => {
      const queryParams = new URLSearchParams({
        url,
        formatId,
        outputDir: options.outputDir,
        format: options.format,
        subtitles: options.subtitles,
        audioMultistreams: options.audioMultistreams.toString(),
        authMode: options.authMode,
        browserName: options.browserName,
        audioFormat: options.audioFormat,
        itemType: itemType,
        videoTitle: videoTitle
      });

      const eventSource = new EventSource(`/api/download?${queryParams.toString()}`);

      eventSource.addEventListener('info', (e) => {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, `> ${data}`]);
      });

      eventSource.addEventListener('log', (e) => {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, data]);

        const progressMatch = data.match(/\[download\]\s+([\d.]+)%/);
        if (progressMatch) {
          setProgress(parseFloat(progressMatch[1]));
        }
      });

      eventSource.addEventListener('done', (e) => {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, `✓ ${data}`]);
        eventSource.close();
        resolve();
      });

      eventSource.addEventListener('error', (e) => {
        const errMsg = e.data ? JSON.parse(e.data) : 'Connection error';
        setLogs(prev => [...prev, `✗ Error: ${errMsg}`]);
        eventSource.close();
        reject(new Error(errMsg));
      });
    });
  };

  // Retry wrapper — attempts up to MAX_RETRIES before giving up
  const MAX_RETRIES = 3;
  const downloadWithRetry = async (formatId, itemType = 'mixed') => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await downloadSingle(formatId, itemType);
        return true; // success
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          const waitSec = attempt * 3; // 3s, 6s, 9s
          setLogs(prev => [...prev, `\n⚠️ Attempt ${attempt}/${MAX_RETRIES} failed for ${formatId}. Retrying in ${waitSec}s...`]);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          setProgress(0);
        } else {
          setLogs(prev => [...prev, `\n❌ All ${MAX_RETRIES} attempts failed for ${formatId}. Skipping...`]);
          return false; // all retries exhausted
        }
      }
    }
    return false;
  };

  // Determine if we're in audio bulk mode
  const isAudioBulkMode = selectedAudios.length > 1 && !options.audioMultistreams;
  const isBulkMode = selectedVideos.length > 1 || isAudioBulkMode;

  const startDownload = async () => {
    if (!url) return;
    if (selectedVideos.length === 0 && selectedAudios.length === 0) {
      alert("Please select at least one video or audio format.");
      return;
    }

    setIsDownloading(true);
    setLogs([]);
    setProgress(0);
    setStatusMsg('');

    let successCount = 0;
    let failCount = 0;

    // === CASE 1: Audio Bulk Mode (multi audios, merging OFF) ===
    if (isAudioBulkMode && selectedVideos.length === 0) {
      const total = selectedAudios.length;
      setBulkProgress({ current: 0, total, currentId: '' });
      setLogs(prev => [...prev, `\n🎵 BULK AUDIO DOWNLOAD: ${total} audio tracks queued\n${'─'.repeat(50)}`]);

      for (let i = 0; i < total; i++) {
        const aud = selectedAudios[i];
        setBulkProgress({ current: i + 1, total, currentId: aud });
        setProgress(0);
        setLogs(prev => [...prev, `\n🎧 [${i + 1}/${total}] Downloading audio track: ${aud}...`]);

        const ok = await downloadWithRetry(aud, 'audio');
        if (ok) successCount++; else failCount++;

        if (i < total - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      setBulkProgress({ current: total, total, currentId: '' });
      const summary = failCount > 0
        ? `Bulk audio download finished: ${successCount}/${total} succeeded, ${failCount} failed after retries.`
        : `Bulk audio download complete! All ${total} tracks downloaded. ✓`;
      setStatusMsg(summary);
      setProgress(100);
      setIsDownloading(false);
      return;
    }

    // === CASE 2: Video Bulk Mode (multi videos) ===
    if (selectedVideos.length > 1) {
      const allItems = [];
      selectedVideos.forEach(v => allItems.push({ id: v, type: 'video' }));
      if (isAudioBulkMode) {
        selectedAudios.forEach(a => allItems.push({ id: a, type: 'audio' }));
      }

      const total = allItems.length;
      setBulkProgress({ current: 0, total, currentId: '' });
      setLogs(prev => [...prev, `\n🚀 BULK DOWNLOAD: ${total} items queued\n${'─'.repeat(50)}`]);

      for (let i = 0; i < total; i++) {
        const item = allItems[i];
        const icon = item.type === 'video' ? '📦' : '🎧';
        setBulkProgress({ current: i + 1, total, currentId: item.id });
        setProgress(0);
        setLogs(prev => [...prev, `\n${icon} [${i + 1}/${total}] Downloading ${item.type}: ${item.id}...`]);

        const ok = await downloadWithRetry(item.id, item.type);
        if (ok) successCount++; else failCount++;

        if (i < total - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      setBulkProgress({ current: total, total, currentId: '' });
      const summary = failCount > 0
        ? `Bulk download finished: ${successCount}/${total} succeeded, ${failCount} failed after retries.`
        : `Bulk download complete! All ${total} items downloaded. ✓`;
      setStatusMsg(summary);
      setProgress(100);
      setIsDownloading(false);
      return;
    }

    // === CASE 3: Single/Merge mode ===
    const formatString = (selectedVideos.length === 1 && selectedAudios.length > 0)
      ? `${selectedVideos[0]}+${selectedAudios.join('+')}`
      : (selectedVideos[0] || selectedAudios.join('+'));

    let singleItemType = 'mixed';
    if (selectedVideos.length === 0 && selectedAudios.length > 0) singleItemType = 'audio';
    else if (selectedVideos.length > 0 && selectedAudios.length === 0) singleItemType = 'video';

    const ok = await downloadWithRetry(formatString, singleItemType);
    setStatusMsg(ok ? 'Download completed! ✓' : 'Download failed after 3 attempts. ✗');
    setProgress(100);
    setIsDownloading(false);
  };

  const startBulkConversion = () => {
    setIsConverting(true);
    setConvertLogs([]);
    setConvertStatusMsg('');

    const eventSource = new EventSource(`/api/convert-mp4-to-mp3`);

    eventSource.addEventListener('info', (e) => {
      const data = JSON.parse(e.data);
      setConvertLogs(prev => [...prev, `> ${data}`]);
    });

    eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      setConvertLogs(prev => [...prev, data]);
    });

    eventSource.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      setConvertStatusMsg(data);
      setIsConverting(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      if (e.data) {
        setConvertStatusMsg(`Error: ${JSON.parse(e.data)}`);
      }
      setIsConverting(false);
      eventSource.close();
    });
  };

  const startUpdate = () => {
    setIsUpdating(true);
    setUpdateLogs([]);
    setUpdateStatusMsg('');

    const eventSource = new EventSource('/api/update-binaries');

    eventSource.addEventListener('info', (e) => {
      const data = JSON.parse(e.data);
      setUpdateLogs(prev => [...prev, `> ${data}`]);
    });

    eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      setUpdateLogs(prev => [...prev, data]);
    });

    eventSource.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      setUpdateStatusMsg(data);
      setIsUpdating(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      if (e.data) {
        setUpdateStatusMsg(`Error: ${JSON.parse(e.data)}`);
      }
      setIsUpdating(false);
      eventSource.close();
    });
  };

  return (
    <div className="bg-[#0b0c10] text-gray-100 min-h-screen font-sans selection:bg-purple-500/30">

      {/* Sticky Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0b0c10]/80 backdrop-blur-md border-b border-gray-800/60 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollTo(homeRef)}>
            <img src="/icon.png" alt="VIDABIN Downloader Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(8,176,213,0.5)]" />
            <span className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#08b0d5] to-[#005bad]">
              VIDABIN Downloader
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-wide">
            <button onClick={() => scrollTo(homeRef)} className="text-gray-300 hover:text-white transition-colors">Home</button>
            <button onClick={() => scrollTo(aboutRef)} className="text-gray-300 hover:text-white transition-colors">About</button>

            {/* Dropdown for Our Tool */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors py-2">
                Our tool <ChevronDown size={16} className="group-hover:rotate-180 transition-transform duration-300" />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-[#1a1b23] border border-gray-700/50 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top overflow-hidden">
                <a href="https://www.vidabinclipper.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 hover:bg-gray-800/50 text-gray-200 transition-colors">
                  <ExternalLink size={16} className="text-blue-400" />
                  VIDABIN Shorts clipper
                </a>
                <button onClick={() => scrollTo(converterRef)} className="flex items-center gap-2 px-4 py-3 w-full text-left hover:bg-gray-800/50 text-gray-200 transition-colors">
                  <Repeat size={16} className="text-purple-400" />
                  Bulk Mp4 To Mp3 convert
                </button>
              </div>
            </div>

            <button onClick={() => scrollTo(tutorialRef)} className="text-gray-300 hover:text-white transition-colors">Tutorial</button>
            <button onClick={() => scrollTo(contactRef)} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-full shadow-lg shadow-purple-500/20 transition-all transform hover:scale-105 active:scale-95">
              Contact Us
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="max-w-5xl mx-auto px-6 pt-32 pb-24 space-y-24">

        {/* === HOME SECTION: Multi Audio Downloader === */}
        <section ref={homeRef} className="scroll-mt-32 space-y-10">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-2">
              <MonitorPlay size={16} /> Premium Extraction Engine
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white drop-shadow-xl leading-tight">
              The Ultimate Multiple Audio-Track <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-[#08b0d5] to-[#005bad] filter drop-shadow-md">Video Downloader</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Extract high-quality video and selectively merge multiple dubbed audio tracks seamlessly in one click.
            </p>
          </div>

          {/* Dependency Warning */}
          {deps.checked && (!deps.ytdlp || !deps.ffmpeg) && (
            <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl backdrop-blur-sm">
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3">
                <AlertTriangle /> Missing Core Dependencies!
              </h2>
              <div className="text-gray-300 text-sm space-y-2">
                {!deps.ytdlp && (
                  <p><strong>yt-dlp</strong> is not installed. Run: <code className="bg-black/50 px-2 py-1 rounded text-red-300 ml-1">pip install yt-dlp</code></p>
                )}
                {!deps.ffmpeg && (
                  <p><strong>FFmpeg</strong> is not installed. Download from <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">ffmpeg.org</a> and add to PATH.</p>
                )}
              </div>
            </div>
          )}



          {/* Step 1: URL Input */}
          <div className="bg-[#13151c] border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-purple-500/30 transition-colors">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-fuchsia-500"></div>
            <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 text-sm">1</span>
              Paste Your Video Link
            </h3>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Link2 className="absolute left-4 top-3.5 text-gray-500" size={22} />
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[#0b0c10] border border-gray-800 text-white rounded-xl py-3.5 pl-12 pr-4 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-lg"
                />
              </div>
              <button
                onClick={handleFetchFormats}
                disabled={!url || fetchingFormats}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white px-8 py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-purple-500/25"
              >
                {fetchingFormats ? (
                  <><span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> Fetching...</>
                ) : (
                  <><Terminal size={20} /> Fetch Formats</>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Format Parser */}
          {rawFormatOutput && (
            <div className="bg-[#13151c] border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-colors">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
              <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 text-sm">2</span>
                Select Quality & Audio Tracks
              </h3>
              <FormatParser
                rawOutput={rawFormatOutput}
                selectedVideos={selectedVideos}
                setSelectedVideos={setSelectedVideos}
                selectedAudios={selectedAudios}
                setSelectedAudios={setSelectedAudios}
              />
            </div>
          )}

          {/* Step 3: Options */}
          <div className="bg-[#13151c] border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-teal-500"></div>
            <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 text-sm">3</span>
              Configure Output Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Final Output Format</label>
                  <select
                    value={options.format}
                    onChange={(e) => setOptions({ ...options, format: e.target.value })}
                    className="w-full bg-[#0b0c10] border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all appearance-none"
                  >
                    <option value="mkv">MKV (Highly Recommended for multiple audio)</option>
                    <option value="mp4">MP4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Subtitle Preferences</label>
                  <select
                    value={options.subtitles}
                    onChange={(e) => setOptions({ ...options, subtitles: e.target.value })}
                    className="w-full bg-[#0b0c10] border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all appearance-none"
                  >
                    <option value="none">Disable Subtitles</option>
                    <option value="all">Download All Available Subtitles</option>
                    <option value="en">English Subtitles Only</option>
                    <option value="auto">Include Auto-Generated Subtitles</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Authentication (Bypass Blocks)</label>
                  <select
                    value={options.authMode}
                    onChange={(e) => setOptions({ ...options, authMode: e.target.value })}
                    className="w-full bg-[#0b0c10] border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all appearance-none"
                  >
                    <option value="default">Default (Auto-detect cookies.txt)</option>
                    <option value="browser">Cookies from Browser (Auto-extract)</option>
                  </select>

                  {options.authMode === 'browser' && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-gray-400 mb-2">Select Browser</label>
                      <select
                        value={options.browserName}
                        onChange={(e) => setOptions({ ...options, browserName: e.target.value })}
                        className="w-full bg-[#0b0c10] border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all appearance-none"
                      >
                        <option value="chrome">Chrome</option>
                        <option value="edge">Edge</option>
                        <option value="firefox">Firefox</option>
                        <option value="brave">Brave</option>
                        <option value="opera">Opera</option>
                      </select>
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                        <p className="text-yellow-400 text-xs font-bold flex items-center gap-1.5 mb-1">
                          ⚠️ Important: Close Your Browser First!
                        </p>
                        <p className="text-yellow-200/70 text-xs leading-relaxed">
                          You must <strong>completely close {options.browserName.charAt(0).toUpperCase() + options.browserName.slice(1)}</strong> (including system tray) before clicking Fetch Formats. The browser locks its cookie database while running.
                        </p>
                      </div>
                    </div>
                  )}
                  {options.authMode === 'default' && (
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      💡 Place a <code className="bg-black/50 text-emerald-300 px-1.5 py-0.5 rounded text-[11px]">cookies.txt</code> file in the tool's root folder. Export it from your browser using the <a href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get cookies.txt LOCALLY</a> extension while logged into YouTube.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Download Destination</label>
                  <div className="relative">
                    <Folder className="absolute left-4 top-3.5 text-gray-500" size={20} />
                    <input
                      type="text"
                      placeholder=".\Downloads"
                      value={options.outputDir}
                      onChange={(e) => setOptions({ ...options, outputDir: e.target.value })}
                      className="w-full bg-[#0b0c10] border border-gray-800 text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-1">
                      <input
                        type="checkbox"
                        checked={options.audioMultistreams}
                        onChange={(e) => setOptions({ ...options, audioMultistreams: e.target.checked })}
                        className="peer w-6 h-6 border-2 border-gray-600 rounded-md bg-transparent checked:bg-emerald-500 checked:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all appearance-none"
                      />
                      <CheckCircle className="absolute text-white w-4 h-4 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <div>
                      <span className="text-gray-200 font-medium group-hover:text-white transition-colors block">
                        Enable Multi-Stream Audio Merging
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        <strong className="text-gray-400">ON:</strong> Merge multiple audio tracks into a single video file (MKV recommended).
                        <br />
                        <strong className="text-gray-400">OFF:</strong> Bulk download each audio track as a separate file — ideal for dubbed language extraction.
                      </p>
                    </div>
                  </label>

                  {/* Audio Format Option */}
                  {selectedAudios.length > 0 && (
                    <div className="pl-9 mt-4">
                      <label className="block text-sm font-medium text-gray-400 mb-2">Audio Output Format (for separate audio tracks)</label>
                      <select
                        value={options.audioFormat}
                        onChange={(e) => setOptions({ ...options, audioFormat: e.target.value })}
                        className="w-full bg-[#0b0c10] border border-gray-800 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none"
                      >
                        <option value="mp3">MP3 (Default)</option>
                        <option value="wav">WAV</option>
                        <option value="m4a">M4A (Original)</option>
                        <option value="flac">FLAC</option>
                        <option value="aac">AAC</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Command Preview */}
          <CommandPreview
            url={url}
            selectedVideos={selectedVideos}
            selectedAudios={selectedAudios}
            options={options}
          />

          {/* Centered Download Button */}
          {/* Bulk Progress Indicator */}
          {isDownloading && bulkProgress.total > 1 && (
            <div className="bg-[#13151c] border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-purple-300 font-bold text-lg">{isAudioBulkMode && selectedVideos.length === 0 ? '🎵 Bulk Audio Download' : '🚀 Bulk Download Progress'}</span>
                <span className="text-white font-mono text-lg">{bulkProgress.current}/{bulkProgress.total}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                ></div>
              </div>
              {bulkProgress.currentId && (
                <p className="text-gray-400 text-sm mt-2">Currently downloading: <span className="text-purple-300 font-mono">{bulkProgress.currentId}</span></p>
              )}
            </div>
          )}

          <div className="flex justify-center mt-12 mb-8">
            <button
              onClick={startDownload}
              disabled={isDownloading || (selectedVideos.length === 0 && selectedAudios.length === 0)}
              className="relative group overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-16 py-5 rounded-full font-black text-xl shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              {isDownloading ? (
                <><span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span> Processing Download...</>
              ) : isBulkMode ? (
                <><Download size={26} className="animate-bounce" /> Bulk Download {selectedVideos.length > 1 ? `${selectedVideos.length} Videos` : ''}{selectedVideos.length > 1 && isAudioBulkMode ? ' + ' : ''}{isAudioBulkMode ? `${selectedAudios.length} Audios` : ''}</>
              ) : (
                <><Download size={26} className="animate-bounce" /> Start Download Now</>
              )}
            </button>
          </div>

          {/* Update Binaries Section */}
          <div className="bg-[#13151c] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-yellow-500/30 transition-colors">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-yellow-500 to-orange-500"></div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-yellow-400"><MonitorPlay size={20} /></span>
                  Core Engine Updater
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  Keep yt-dlp and deno engines up to date manually to bypass the latest YouTube restrictions.
                </p>
              </div>
              <button
                onClick={startUpdate}
                disabled={isUpdating}
                className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 border border-gray-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
              >
                {isUpdating ? (
                  <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> Updating...</>
                ) : (
                  <><Repeat size={16} /> Update Binaries</>
                )}
              </button>
            </div>

            {/* Updater Logs */}
            {(updateLogs.length > 0 || isUpdating || updateStatusMsg) && (
              <div className="mt-4 bg-black/50 border border-gray-800 rounded-lg p-4">
                <div className="h-32 overflow-y-auto font-mono text-xs text-gray-300 space-y-1">
                  {updateLogs.map((log, i) => (
                    <div key={i} className="break-all">{log}</div>
                  ))}
                  {updateStatusMsg && (
                    <div className="text-yellow-400 font-bold mt-2 pt-2 border-t border-gray-800">
                      {updateStatusMsg}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Step 5: Terminal logs for download */}
          {(logs.length > 0 || isDownloading || statusMsg) && (
            <TerminalLog
              logs={logs}
              isDownloading={isDownloading}
              progress={progress}
              statusMsg={statusMsg}
            />
          )}
        </section>

        {/* Divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-800 to-transparent my-12"></div>

        {/* === CONVERTER SECTION: Bulk Mp4 to Mp3 === */}
        <section ref={converterRef} className="scroll-mt-32">
          <div className="bg-gradient-to-br from-[#1a1c29] to-[#13151c] border border-gray-800 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="space-y-4 md:w-2/3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-sm font-medium">
                  <FileAudio size={16} /> Batch Processing
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-white">
                  Bulk MP4 to MP3 <span className="text-fuchsia-400">Converter</span>
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed">
                  Instantly convert all your downloaded video files into high-quality MP3 audio tracks. With a single click, our engine scans your default <code className="bg-black/50 text-fuchsia-300 px-2 py-0.5 rounded text-sm font-mono">Downloads</code> folder and extracts the audio seamlessly into a dedicated <code className="bg-black/50 text-fuchsia-300 px-2 py-0.5 rounded text-sm font-mono">mp3</code> folder.
                </p>
              </div>

              <div className="md:w-1/3 flex justify-center">
                <button
                  onClick={startBulkConversion}
                  disabled={isConverting}
                  className="bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-[0_0_30px_rgba(192,38,211,0.3)] hover:shadow-[0_0_50px_rgba(192,38,211,0.5)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 w-full justify-center"
                >
                  {isConverting ? (
                    <><span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span> Converting...</>
                  ) : (
                    <><Repeat size={24} /> Convert All to MP3</>
                  )}
                </button>
              </div>
            </div>

            {/* Converter Terminal Logs */}
            {(convertLogs.length > 0 || isConverting || convertStatusMsg) && (
              <div className="mt-8 bg-black/50 border border-gray-800 rounded-xl p-5">
                <div className="h-48 overflow-y-auto font-mono text-sm text-gray-300 space-y-1">
                  {convertLogs.map((log, i) => (
                    <div key={i} className="break-all">{log}</div>
                  ))}
                  {convertStatusMsg && (
                    <div className="text-emerald-400 font-bold mt-2 pt-2 border-t border-gray-800">
                      {convertStatusMsg}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* === ABOUT & CONTACT SECTION === */}
        <section ref={aboutRef} className="scroll-mt-32 grid md:grid-cols-2 gap-8">

          {/* About */}
          <div className="bg-[#13151c] border border-gray-800 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium mb-6">
              <Info size={16} /> Who We Are
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-6">
              About <span className="text-blue-400">VIDABIN Labs</span>
            </h2>
            <div className="space-y-4 text-gray-300 leading-relaxed text-lg">
              <p>
                Welcome to <strong>VIDABIN Labs</strong>, your premium video translation and dubbing agency.
                We specialize in providing high-end, affordable solutions for Social Media Ads and all types of video content.
              </p>
              <p>
                Our unique approach bridges the gap between technology and human creativity. We translate and dub your videos into
                multiple global languages utilizing a strategic combination of <strong>human translation precision</strong>,
                <strong>advanced AI voiceover generation</strong>, and meticulous <strong>manual synchronization</strong>.
              </p>
              <p>
                Expand your reach, engage global audiences, and break language barriers seamlessly with VIDABIN Labs.
              </p>
            </div>
          </div>

          {/* Contact */}
          <div ref={contactRef} className="scroll-mt-32 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-gray-800 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none"></div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-6">
              <PhoneCall size={16} /> Get In Touch
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-8">
              Contact <span className="text-purple-400">Addresses</span>
            </h2>

            <ul className="space-y-5">
              <li>
                <a href="https://www.vidabinlabs.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group p-3 rounded-xl hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <ExternalLink size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Our Dubbing Agency</h4>
                    <p className="text-gray-400 text-sm">www.vidabinlabs.com</p>
                  </div>
                </a>
              </li>
              <li>
                <a href="https://www.vidabinclipper.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group p-3 rounded-xl hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 group-hover:scale-110 transition-transform">
                    <ExternalLink size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">VIDABIN Shorts Clipper</h4>
                    <p className="text-gray-400 text-sm">www.vidabinclipper.com</p>
                  </div>
                </a>
              </li>
              <li>
                <a href="https://www.facebook.com/VidabinLabs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group p-3 rounded-xl hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    <ExternalLink size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Facebook</h4>
                    <p className="text-gray-400 text-sm">Official Facebook Page</p>
                  </div>
                </a>
              </li>
              <li>
                <a href="https://whop.com/joined/vidabinclipper/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group p-3 rounded-xl hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Whop Community</h4>
                    <p className="text-gray-400 text-sm">VIDABIN Clipper | Whop</p>
                  </div>
                </a>
              </li>
              <li>
                <a href="https://t.me/vidabinclipper" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group p-3 rounded-xl hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                    <ExternalLink size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg">Telegram Community</h4>
                    <p className="text-gray-400 text-sm">@vidabinclipper</p>
                  </div>
                </a>
              </li>
            </ul>
          </div>
        </section>

        {/* === TUTORIAL SECTION === */}
        <section ref={tutorialRef} className="scroll-mt-32">
          <div className="bg-[#13151c] border border-gray-800 rounded-3xl p-10 shadow-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium mb-6">
              <BookOpen size={16} /> User Guide
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-8">
              How to Use Our <span className="text-emerald-400">Tools</span>
            </h2>

            <div className="space-y-10">
              {/* Tutorial 1 */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-purple-400 border-b border-gray-800 pb-2">
                  1. VIDABIN Multi Audio Downloader
                </h3>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">1</span>
                    <p><strong>Paste the Link:</strong> Copy a YouTube video URL and paste it into the "Video URL" input field at the top of the application.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">2</span>
                    <p><strong>Fetch Formats:</strong> Click the "Fetch Formats" button. The engine will scan the video and display all available video resolutions and audio tracks.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">3</span>
                    <p><strong>Select Tracks:</strong> Choose your desired video resolution. Then, select one or multiple audio tracks (e.g., original language, Spanish dub, etc.).</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">4</span>
                    <p><strong>Configure Settings:</strong> Ensure the final output format is set to MKV (recommended for multiple audio tracks) and verify the download destination folder.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">5</span>
                    <p><strong>Download:</strong> Click the big "Start Download Now" button. The tool will download and merge everything seamlessly into your specified folder.</p>
                  </li>
                </ul>
              </div>

              {/* Tutorial 2 */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-fuchsia-400 border-b border-gray-800 pb-2">
                  2. Bulk MP4 to MP3 Converter
                </h3>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">1</span>
                    <p><strong>Locate your files:</strong> Ensure the `.mp4` video files you wish to convert are stored in the default `Downloads` folder of this project.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">2</span>
                    <p><strong>Start Conversion:</strong> Scroll to the "Bulk MP4 to MP3 Converter" section and click "Convert All to MP3".</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">3</span>
                    <p><strong>Wait for processing:</strong> The tool will automatically scan the folder and convert every MP4 file into high-quality MP3 format.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">4</span>
                    <p><strong>Access your audio:</strong> Once finished, all your MP3 files will be neatly saved inside the `Downloads/mp3` directory.</p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Custom Keyframes for Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes shimmer {
          100% {
            transform: translateX(100%) skewX(12deg);
          }
        }
      `}} />
    </div>
  );
}

export default App;
