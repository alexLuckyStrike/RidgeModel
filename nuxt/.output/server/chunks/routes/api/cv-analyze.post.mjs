import { d as defineEventHandler, u as useRuntimeConfig, r as readMultipartFormData, c as createError } from '../../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const cvAnalyze_post = defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const base = config.cvBackendBase || "http://localhost:4000";
  const parts = await readMultipartFormData(event);
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: "No files provided" });
  }
  const form = new FormData();
  for (const part of parts) {
    if (!part.name) continue;
    const blob = new Blob([part.data], { type: part.type || "application/octet-stream" });
    form.append(part.name, blob, part.filename || part.name);
  }
  const res = await $fetch.raw(`${base}/api/analyze`, {
    method: "POST",
    body: form
  });
  return res._data;
});

export { cvAnalyze_post as default };
//# sourceMappingURL=cv-analyze.post.mjs.map
