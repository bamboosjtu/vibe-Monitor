import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";

const DATA_ROUTE_PREFIX = "/data/";
const DATA_MIME_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function serveDataFile(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  if (!req.url?.startsWith(DATA_ROUTE_PREFIX)) {
    next();
    return;
  }

  const requestPath = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const relativePath = requestPath.slice(DATA_ROUTE_PREFIX.length);

  if (!relativePath || relativePath.includes("..")) {
    res.statusCode = 400;
    res.end("Invalid data path");
    return;
  }

  const publicDataDir = path.resolve(__dirname, "public", "data");
  const repoDataDir = path.resolve(__dirname, "..", "data");
  const candidates = [
    path.resolve(publicDataDir, relativePath),
    path.resolve(repoDataDir, relativePath),
  ];

  const filePath = candidates.find((candidate) => {
    const insideAllowedRoot =
      candidate.startsWith(publicDataDir + path.sep) ||
      candidate.startsWith(repoDataDir + path.sep);

    return (
      insideAllowedRoot &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    );
  });

  if (!filePath) {
    next();
    return;
  }

  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    DATA_MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream",
  );
  fs.createReadStream(filePath).pipe(res);
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "serve-repo-data",
      configureServer(server) {
        server.middlewares.use(serveDataFile);
      },
      configurePreviewServer(server) {
        server.middlewares.use(serveDataFile);
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
