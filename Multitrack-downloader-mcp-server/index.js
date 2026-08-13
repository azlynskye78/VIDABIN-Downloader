#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

import { handleCheckDependencies } from "./tools/check-deps.js";
import { handleListFormats } from "./tools/list-formats.js";
import { handleDownloadTracks } from "./tools/download.js";
import { handleBatchDownload } from "./tools/batch.js";
import { handleUpdateBinaries } from "./tools/update.js";
import { handleConvertAudio } from "./tools/convert.js";

const server = new McpServer({
  name: "vidabin-multitrack-download-mcp",
  version: "1.0.0",
});

// Tool 1: check_dependencies
server.tool(
  "check_dependencies",
  "Check if yt-dlp, ffmpeg, deno, and node binaries are available and return their versions.",
  {},
  async () => {
    try {
      return await handleCheckDependencies();
    } catch (error) {
      console.error("Error in check_dependencies:", error);
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool 2: list_formats
server.tool(
  "list_formats",
  "List all available video and audio formats/tracks for a YouTube URL, including all dubbed language audio tracks.",
  {
    url: z.string().describe("YouTube video URL"),
    cookies_file: z.string().optional().describe("Path to cookies.txt file"),
  },
  async ({ url, cookies_file }) => {
    try {
      return await handleListFormats({ url, cookies_file });
    } catch (error) {
      console.error("Error in list_formats:", error);
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool 3: download_tracks
server.tool(
  "download_tracks",
  "Download specific audio tracks, video streams, or combined video+audio for a single YouTube URL with language selection.",
  {
    url: z.string().describe("YouTube video URL"),
    download_type: z.enum(["audio_only", "video_only", "video_with_audio", "video_with_all_audio"]).default("audio_only").describe("Download type"),
    languages: z.array(z.string()).default(["all"]).describe("Language codes like bn, hi, en or all"),
    audio_format: z.enum(["mp3", "wav", "m4a", "flac", "aac"]).default("mp3").describe("Audio output format"),
    audio_quality: z.enum(["best", "medium", "lowest", "all"]).default("best").describe("Audio quality per language: best (default, 1 track per language), medium, lowest, or all variants"),
    video_quality: z.enum(["best", "2160p", "1440p", "1080p", "720p", "480p", "360p"]).default("best").optional().describe("Video quality (default: best available)"),
    video_format: z.enum(["mkv", "mp4", "webm"]).default("mkv").optional().describe("Video container format"),
    subtitles: z.enum(["none", "all", "en", "auto"]).default("none").describe("Subtitle option"),
    output_dir: z.string().optional().describe("Output directory path (default: mcp-server/Downloads)"),
    cookies_file: z.string().optional().describe("Path to cookies.txt file"),
    max_retries: z.number().default(3).describe("Maximum retry attempts"),
  },
  async (params) => {
    try {
      return await handleDownloadTracks(params);
    } catch (error) {
      console.error("Error in download_tracks:", error);
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool 4: batch_download
server.tool(
  "batch_download",
  "Process a batch of multiple videos from a JSON configuration. Handles 100+ videos with cookie rotation and progress tracking.",
  {
    batch_config: z.any().optional().describe("JSON object with global_settings and videos array"),
    batch_file: z.string().optional().describe("Path to batch config JSON file"),
  },
  async ({ batch_config, batch_file }) => {
    try {
      return await handleBatchDownload({ batch_config, batch_file });
    } catch (error) {
      console.error("Error in batch_download:", error);
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool 5: update_binaries
server.tool(
  "update_binaries",
  "Update yt-dlp to the latest version. Important because YouTube frequently changes its API.",
  {},
  async () => {
    try {
      return await handleUpdateBinaries();
    } catch (error) {
      console.error("Error in update_binaries:", error);
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Tool 6: convert_audio
server.tool(
  "convert_audio",
  "Convert audio files from one format to another using FFmpeg.",
  {
    source_dir: z.string().describe("Source directory containing audio files"),
    target_format: z.enum(["mp3", "wav", "flac", "aac", "m4a"]).default("mp3").describe("Target audio format"),
    output_dir: z.string().optional().describe("Output directory (defaults to sibling of source)"),
  },
  async ({ source_dir, target_format, output_dir }) => {
    try {
      return await handleConvertAudio({ source_dir, target_format, output_dir });
    } catch (error) {
      console.error("Error in convert_audio:", error);
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Start the Server (supports both Express HTTP for MCPize Cloud & stdio for local desktop)
async function main() {
  const isHttp = process.env.PORT || process.argv.includes("--http") || process.env.MCPIZE;

  if (isHttp) {
    const app = express();
    app.use(express.json());

    // Health check endpoint required by Cloud Run / MCPize Cloud
    app.get("/health", (_req, res) => {
      res.status(200).json({ status: "healthy" });
    });

    app.get("/", (_req, res) => {
      res.status(200).json({ name: "vidabin-multitrack-download-mcp", status: "healthy" });
    });

    // MCP Streamable HTTP endpoint
    app.post("/mcp", async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    // JSON error handler
    app.use((err, _req, res, _next) => {
      console.error("Express internal error:", err);
      res.status(500).json({ error: "Internal server error" });
    });

    const port = parseInt(process.env.PORT || "8080");
    const httpServer = app.listen(port, () => {
      console.error(`VIDABIN Multitrack MCP Server running on HTTP port ${port}`);
      console.error(`  Health check: http://localhost:${port}/health`);
      console.error(`  MCP Endpoint: http://localhost:${port}/mcp`);
    });

    process.on("SIGTERM", () => {
      console.error("Received SIGTERM, shutting down gracefully...");
      httpServer.close(() => process.exit(0));
    });
  } else {
    // stdio transport for local desktop AI clients
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("VIDABIN Multitrack MCP Server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
