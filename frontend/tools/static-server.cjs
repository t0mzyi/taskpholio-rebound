const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3010);
const host = "127.0.0.1";
const baseDir = path.join(__dirname, "..", "public");

const mimeByExt = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function safeResolve(urlPath) {
  const stripped = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(stripped).replace(/^(\.\.[/\\])+/, "");
  return path.join(baseDir, normalized === "/" ? "/index.html" : normalized);
}

const server = http.createServer((req, res) => {
  const reqPath = req.url === "/" ? "/mobile-uiux-capture.html" : req.url;
  const filePath = safeResolve(reqPath);

  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeByExt[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, host, () => {
  console.log(`Static server running at http://${host}:${port}/`);
});
