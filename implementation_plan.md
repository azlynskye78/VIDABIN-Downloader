# yt-dlp Multi-Audio Downloader Implementation Plan

This document outlines the architecture and implementation steps for building the desktop-ready web application for downloading YouTube videos with multiple dubbed audio tracks.

## Goal Description
Build a local web application using React + Tailwind CSS (frontend) and Node.js + Express (backend) to provide a rich UI over `yt-dlp`. It specifically targets the complex use case of downloading multiple audio tracks (dubbed tracks) along with a selected video stream, which is notoriously difficult to do via CLI.

## User Review Required
> [!IMPORTANT]
> - **File System Access:** Browsers cannot directly pick an arbitrary "output directory" and save a file there due to security restrictions. The "Output directory picker" in a web app can be a simple text input where the user types/pastes a path (e.g., `C:\Downloads`), or we can use the backend to provide a custom file/folder browser UI. I propose using a simple text input for the output directory for the first version, defaulting to the current directory or `Downloads`. Please confirm if this is acceptable.
> - **Concurrent Execution:** I will use `concurrently` (or a similar tool) in `package.json` so that running `npm run dev` starts both the Vite frontend server and the Express backend server on different ports. The Vite frontend will proxy API requests to the backend.

## Open Questions
> [!WARNING]
> 1. **Project Scaffold:** The current directory is `d:\MyAI\Content create\Multitrack Audio download`. Should I overwrite/initialize the project directly in this directory (so `package.json` is at the root)?
> 2. **Default Directory:** What should be the default output directory for downloads? (e.g., `./downloads` relative to the project, or the user's OS Downloads folder?)

## Proposed Changes

### 1. Project Initialization & Tooling
- Initialize a Vite + React project in the current directory.
- Install Tailwind CSS, `lucide-react` (for icons), and `concurrently` (for running dev servers).
- Set up `server.js` for the Express backend.
- Configure `vite.config.js` to proxy `/api` requests to the Express server (running on port 3001).

#### [NEW] package.json
Configure dependencies and `npm run dev` script to run both servers.

#### [NEW] vite.config.js
Configure proxy.

#### [NEW] tailwind.config.js / postcss.config.js / index.css
Set up Tailwind CSS with the requested dark theme (`#0f0f1a` bg, `#7c3aed` accent).

### 2. Backend API (`server.js`)
Build the Node.js Express server using `child_process.exec` and `child_process.spawn`.

#### [NEW] server.js
Endpoints:
- `GET /api/check-deps`: Runs `yt-dlp --version` and `ffmpeg -version`.
- `POST /api/list-formats`: Takes a `{ url }`, runs `yt-dlp -F "<url>"`, returns raw stdout.
- `POST /api/download`: Takes `{ url, formatId, options }`. Uses `spawn` to run the full `yt-dlp` command. Pipes `stdout`/`stderr` using Server-Sent Events (SSE) to stream the terminal output and progress in real-time.

### 3. Frontend Architecture (`src/`)
Create the React application components following the step-by-step layout.

#### [NEW] src/App.jsx
Main component managing the state and the 4 numbered steps. Includes the dependency check banner on startup.

#### [NEW] src/components/FormatParser.jsx
Parses the raw `yt-dlp -F` output. Extracts video and audio streams into separate tables. Highlights dubbed tracks (ids like `x-y`) and original audio.

#### [NEW] src/components/CommandPreview.jsx
Generates and displays the `yt-dlp` CLI command dynamically based on selected video/audio formats and options.

#### [NEW] src/components/TerminalLog.jsx
A monospace, scrollable terminal component that connects to the `/api/download` SSE stream to show real-time download progress.

## Verification Plan

### Automated/Manual Verification
1. Run `npm install` and `npm run dev` to ensure both servers start.
2. Verify the Dependency Check banner properly identifies `yt-dlp` and `ffmpeg` presence on the system.
3. Test a YouTube URL, fetch formats, and ensure the format parser correctly separates video and audio tracks, especially multi-language ones.
4. Verify the Command Preview updates in real-time as checkboxes are toggled.
5. Execute a test download and ensure the SSE terminal logs the output correctly.
