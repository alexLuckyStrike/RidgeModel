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
const mapFieldName = (name) => {
  if (name.startsWith("rest2_")) return "rest2";
  if (name.startsWith("rest5_")) return "rest5";
  if (name.startsWith("load5_")) return "load5";
  if (name.startsWith("load2_")) return "load2";
  if (name.startsWith("workout_photo_")) return "workout";
  if (name.startsWith("workout_text_")) return "text";
  return name;
};
const mapScaleZone = (raw) => {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const z = asRecord(raw) || {};
  const rgb = Array.isArray(z.rgb) ? z.rgb : [0, 0, 0];
  const lab = Array.isArray(z.lab) ? z.lab : [0, 0, 0];
  const bbox = Array.isArray(z.text_bbox) ? z.text_bbox : null;
  return {
    zone_index: (_a = asNumber(z.zone_index)) != null ? _a : 0,
    label: asString(z.label) || "L?",
    rgb: [(_b = rgb[0]) != null ? _b : 0, (_c = rgb[1]) != null ? _c : 0, (_d = rgb[2]) != null ? _d : 0],
    lab: [
      typeof lab[0] === "number" ? lab[0] : 0,
      typeof lab[1] === "number" ? lab[1] : 0,
      typeof lab[2] === "number" ? lab[2] : 0
    ],
    text: asString(z.text),
    text_confidence: asNumber(z.text_confidence),
    text_bbox: bbox ? [(_e = bbox[0]) != null ? _e : 0, (_f = bbox[1]) != null ? _f : 0, (_g = bbox[2]) != null ? _g : 0, (_h = bbox[3]) != null ? _h : 0] : null
  };
};
const mapZone = (raw, idx) => {
  const zone = asRecord(raw) || {};
  const nearest = asRecord(zone.nearest) || {};
  return {
    index: idx,
    level: asString(nearest.label) || "\u2014",
    delta_e: asNumber(nearest.delta_e)
  };
};
const mapStrip = (raw, groupName) => {
  var _a;
  const item = asRecord(raw);
  if (!item) return null;
  const stripIndex = (_a = asNumber(item.strip_index)) != null ? _a : 1;
  if (stripIndex !== 1) return null;
  const zones = asArray(item.zones).map((z, i) => mapZone(z, i + 1));
  return {
    photo_filename: asString(item.filename) || "unknown",
    strip_index: 1,
    zone_count: zones.length,
    scale_id: asString(item.matched_scale_id),
    zones
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
      strips: { rest: [], load: [] },
      ocr: { items: [] },
      meta: { scale_profiles: [], note: null },
      error: message,
      message
    };
  }
  const meta = asRecord(payload.meta) || {};
  const session_id = asString(meta.session_id) || asString(root.sessionId);
  const scale_profiles = asArray(meta.scale_profiles).map((p) => {
    var _a2, _b2;
    const pr = asRecord(p) || {};
    return {
      id: asString(pr.id) || "unknown",
      zone_count: (_a2 = asNumber(pr.count)) != null ? _a2 : 0,
      palette_size: (_b2 = asNumber(pr.palette_size)) != null ? _b2 : 0,
      filename: asString(pr.filename) || "",
      zones: asArray(pr.zones).map(mapScaleZone)
    };
  });
  const restStrips = asArray((_a = asRecord(payload.rest)) == null ? void 0 : _a.items).map((item) => mapStrip(item)).filter((s) => s !== null);
  const loadStrips = asArray((_b = asRecord(payload.load)) == null ? void 0 : _b.items).map((item) => mapStrip(item)).filter((s) => s !== null);
  const ocrItems = asArray((_c = asRecord(payload.ocr)) == null ? void 0 : _c.items).map(mapOcrItem);
  return {
    status: "ok",
    session_id,
    strips: {
      rest: restStrips,
      load: loadStrips
    },
    ocr: { items: ocrItems },
    meta: {
      scale_profiles,
      note: asString(meta.note)
    }
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
