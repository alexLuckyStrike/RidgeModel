import { d as defineEventHandler, r as readBody, u as useRuntimeConfig, s as setResponseHeader } from '../../_/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const pdf_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();
  const base = config.public.backendBase || "http://localhost:3001";
  const res = await $fetch.raw(`${base}/pdf`, {
    method: "POST",
    body,
    responseType: "arrayBuffer"
  });
  setResponseHeader(event, "content-type", res.headers.get("content-type") || "application/pdf");
  setResponseHeader(
    event,
    "content-disposition",
    res.headers.get("content-disposition") || 'attachment; filename="training-plan.pdf"'
  );
  return Buffer.from(res._data);
});

export { pdf_post as default };
//# sourceMappingURL=pdf.post.mjs.map
