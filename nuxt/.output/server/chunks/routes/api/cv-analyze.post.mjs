import { d as defineEventHandler, u as useRuntimeConfig, r as readMultipartFormData, c as createError } from '../../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const asRecord = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : null;
const asString = (v) => typeof v === "string" && v.trim() ? v.trim() : null;
const asNumber = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
const asArray = (v) => Array.isArray(v) ? v : [];
const asNumberRecord = (v) => {
  const rec = asRecord(v) || {};
  const out = {};
  for (const [k, value] of Object.entries(rec)) {
    if (typeof value === "number" && Number.isFinite(value)) out[k] = value;
  }
  return out;
};
const asStringRecord = (v) => {
  const rec = asRecord(v) || {};
  const out = {};
  for (const [k, value] of Object.entries(rec)) {
    if (typeof value === "string" && value.trim()) out[k] = value.trim();
  }
  return out;
};
const mapFieldName = (name) => {
  if (name.startsWith("rest2_")) return "rest2";
  if (name.startsWith("rest5_")) return "rest5";
  if (name.startsWith("load5_")) return "load5";
  if (name.startsWith("load2_")) return "load2";
  if (name.startsWith("workout_photo_")) return "workout";
  if (name.startsWith("workout_text_")) return "text";
  return name;
};
const mapMedical = (raw, source) => {
  var _a;
  const item = asRecord(raw);
  if (!item) return null;
  return {
    source,
    photo_filename: asString(item.filename) || "unknown",
    strip_index: (_a = asNumber(item.strip_index)) != null ? _a : 1,
    results: asNumberRecord(item.results),
    units: asStringRecord(item.units)
  };
};
const mapOcrItem = (raw) => {
  const item = asRecord(raw) || {};
  return {
    filename: asString(item.filename) || "unknown",
    text: asString(item.text) || "",
    warning: asString(item.warning)
  };
};
const normalizeCvResponse = (rawResponse) => {
  var _a, _b, _c;
  const root = asRecord(rawResponse) || {};
  const payload = asRecord(root.result) || root;
  const isError = root.ok === false || payload.ok === false || Boolean(asString(root.error) || asString(payload.error));
  if (isError) {
    const message = asString(payload.error) || asString(root.error) || asString(payload.message) || asString(root.message) || "CV analyze failed";
    return {
      status: "error",
      session_id: null,
      medical_tests: [],
      workout: { notes: [] },
      error: message,
      message
    };
  }
  const meta = asRecord(payload.meta) || {};
  const session_id = asString(meta.session_id) || asString(root.sessionId);
  const restItems = asArray((_a = asRecord(payload.rest)) == null ? void 0 : _a.items).map((item) => mapMedical(item, "rest")).filter((s) => s !== null);
  const loadItems = asArray((_b = asRecord(payload.load)) == null ? void 0 : _b.items).map((item) => mapMedical(item, "load")).filter((s) => s !== null);
  const notes = asArray((_c = asRecord(payload.ocr)) == null ? void 0 : _c.items).map(mapOcrItem).map((x) => x.text).filter((x) => !!x);
  return {
    status: "ok",
    session_id,
    medical_tests: [...restItems, ...loadItems],
    workout: { notes }
  };
};
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
    const mappedName = mapFieldName(part.name);
    const blob = new Blob([part.data], { type: part.type || "application/octet-stream" });
    form.append(mappedName, blob, part.filename || mappedName);
  }
  try {
    const res = await $fetch.raw(`${base}/api/analyze`, {
      method: "POST",
      body: form
    });
    return normalizeCvResponse(res._data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CV backend request failed";
    throw createError({
      statusCode: 502,
      statusMessage: "CV backend error",
      message
    });
  }
});

export { cvAnalyze_post as default };
//# sourceMappingURL=cv-analyze.post.mjs.map
