import React, { useEffect, useRef } from 'react';

const TerminalLog = ({ logs, isDownloading, progress, statusMsg }) => {
  const terminalRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold mb-4 text-purple-400 flex items-center gap-2">
        Step 5: Download Execution
        {isDownloading && (
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
          </span>
        )}
      </h3>

      <div className="bg-black border border-gray-800 rounded-lg overflow-hidden shadow-2xl">
        <div className="bg-gray-800 px-4 py-2 flex items-center gap-2 border-b border-gray-700">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-2 text-xs text-gray-400 font-mono">Terminal Output</span>
        </div>
        
        <div 
          ref={terminalRef}
          className="p-4 h-80 overflow-y-auto font-mono text-xs custom-scrollbar bg-black"
        >
          {logs.length === 0 ? (
            <div className="text-gray-600 italic">Awaiting execution...</div>
          ) : (
            logs.map((log, i) => {
              // Colorize based on content
              let textColor = 'text-gray-300';
              if (log.includes('[download]')) textColor = 'text-blue-400';
              if (log.includes('WARNING:')) textColor = 'text-yellow-400';
              if (log.includes('ERROR:')) textColor = 'text-red-400';
              if (log.includes('info')) textColor = 'text-green-400';
              
              return (
                <div key={i} className={`whitespace-pre-wrap break-all ${textColor}`}>
                  {log.trim()}
                </div>
              );
            })
          )}
        </div>
        
        {/* Progress Bar (if active) */}
        {isDownloading && (
          <div className="bg-gray-900 border-t border-gray-800 p-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Downloading...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Status Message */}
        {statusMsg && !isDownloading && (
          <div className={`p-3 text-sm font-semibold border-t border-gray-800 ${statusMsg.includes('error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalLog;
