import { d as defineEventHandler, g as getQuery, c as createError, s as setResponseHeader } from '../../nitro/nitro.mjs';
import fs from 'fs/promises';
import path from 'path';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const ALLOWED_ROOTS = [
  "/Users/admin/Desktop/training",
  "/Users/admin/Desktop/\u0410\u0440\u0442\u0435\u043C \u041F\u0443\u0442\u0438\u043D\u0446\u0435\u0432 \u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A1",
  "/Users/admin/Desktop"
].map((root) => path.resolve(root));
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};
const startsWithRoot = (targetPath, root) => targetPath === root || targetPath.startsWith(`${root}${path.sep}`);
const mvpDemoFile_get = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawPath = typeof query.path === "string" ? query.path : "";
  if (!rawPath) {
    throw createError({ statusCode: 400, statusMessage: "path query is required" });
  }
  const decoded = decodeURIComponent(rawPath);
  const resolved = path.resolve(decoded);
  const isAllowed = ALLOWED_ROOTS.some((root) => startsWithRoot(resolved, root));
  if (!isAllowed) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden file path" });
  }
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }
  if (!stat.isFile()) {
    throw createError({ statusCode: 400, statusMessage: "Path is not a file" });
  }
  const ext = path.extname(resolved).toLowerCase();
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";
  const fileData = await fs.readFile(resolved);
  setResponseHeader(event, "content-type", mime);
  setResponseHeader(event, "cache-control", "no-store");
  return fileData;
});

export { mvpDemoFile_get as default };
//# sourceMappingURL=mvp-demo-file.get.mjs.map
