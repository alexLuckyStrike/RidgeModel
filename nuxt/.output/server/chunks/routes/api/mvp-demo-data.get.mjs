import { d as defineEventHandler } from '../../nitro/nitro.mjs';
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

const DESKTOP_ROOT = "/Users/admin/Desktop";
const TRAINING_DIR = "/Users/admin/Desktop/training";
const PARTICIPANT_DIR = "/Users/admin/Desktop/\u0410\u0440\u0442\u0435\u043C \u041F\u0443\u0442\u0438\u043D\u0446\u0435\u0432 \u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A1";
const REST_DIR = "/Users/admin/Desktop/\u0410\u0440\u0442\u0435\u043C \u041F\u0443\u0442\u0438\u043D\u0446\u0435\u0432 \u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A1/\u0411\u0435\u0437 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438";
const REST_PINNED_FILES = [
  "/Users/admin/Desktop/\u0410\u0440\u0442\u0435\u043C \u041F\u0443\u0442\u0438\u043D\u0446\u0435\u0432 \u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A1/\u0411\u0435\u0437 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438/photo_2026-02-02_21-08-05.jpg"
];
const IMAGE_EXTS = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".heic", ".webp"]);
const TEXT_EXTS = /* @__PURE__ */ new Set([".txt", ".md", ".png", ".jpg", ".jpeg"]);
const ext = (filePath) => path.extname(filePath).toLowerCase();
const isImage = (filePath) => IMAGE_EXTS.has(ext(filePath));
const isWorkoutInfo = (filePath) => TEXT_EXTS.has(ext(filePath));
const sortByName = (files) => files.sort((a, b) => a.localeCompare(b, "ru"));
async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
async function listFiles(dir, recursive = false) {
  if (!await exists(dir)) return [];
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isFile()) {
      out.push(abs);
      continue;
    }
    if (recursive && entry.isDirectory()) {
      out.push(...await listFiles(abs, true));
    }
  }
  return out;
}
async function pickScaleFiles() {
  const topFiles = await listFiles(DESKTOP_ROOT, false);
  const jpegOnly = topFiles.filter((file) => [".jpeg", ".jpg"].includes(ext(file)));
  const dated = await Promise.all(
    jpegOnly.map(async (file) => ({
      file,
      mtime: (await fs.stat(file)).mtimeMs
    }))
  );
  return dated.sort((a, b) => b.mtime - a.mtime).slice(0, 2).map((item) => item.file);
}
function toItems(files) {
  return files.map((file) => ({
    name: path.basename(file),
    path: file
  }));
}
const mvpDemoData_get = defineEventHandler(async () => {
  const notes = [];
  const scales = await pickScaleFiles();
  if (scales.length < 2) {
    notes.push("\u041D\u0430\u0439\u0434\u0435\u043D\u043E \u043C\u0435\u043D\u044C\u0448\u0435 \u0434\u0432\u0443\u0445 JPEG-\u0444\u0430\u0439\u043B\u043E\u0432 \u0434\u043B\u044F \u0448\u043A\u0430\u043B \u043D\u0430 Desktop.");
  }
  const trainingFiles = sortByName((await listFiles(TRAINING_DIR, true)).filter(isWorkoutInfo));
  if (!trainingFiles.length) {
    notes.push('\u041F\u0430\u043F\u043A\u0430 training \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0444\u0430\u0439\u043B\u043E\u0432 \u0434\u043B\u044F \u0431\u043B\u043E\u043A\u0430 "\u041D\u0430\u0433\u0440\u0443\u0437\u043A\u0430".');
  }
  const restFilesExplicit = sortByName((await listFiles(REST_DIR, true)).filter(isImage));
  const participantAllImages = sortByName((await listFiles(PARTICIPANT_DIR, true)).filter(isImage));
  const pinnedRestFiles = (await Promise.all(
    REST_PINNED_FILES.map(async (file) => await exists(file) ? file : null)
  )).filter((file) => Boolean(file));
  const restFiles = Array.from(/* @__PURE__ */ new Set([
    ...pinnedRestFiles,
    ...restFilesExplicit
  ])).slice(0, 2);
  if (pinnedRestFiles.length) {
    notes.push(`\u0424\u043E\u0442\u043E \u0434\u043B\u044F "\u041F\u043E\u043A\u043E\u0439" \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u044B \u0432\u0440\u0443\u0447\u043D\u0443\u044E: ${pinnedRestFiles.map((f) => path.basename(f)).join(", ")}`);
  }
  if (!restFiles.length) {
    notes.push('\u041F\u0430\u043F\u043A\u0430 "\u0411\u0435\u0437 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438" \u043F\u0443\u0441\u0442\u0430. \u0411\u043B\u043E\u043A "\u041F\u043E\u043A\u043E\u0439" \u043D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.');
  }
  const restSet = new Set(restFiles);
  const loadFiles = participantAllImages.filter((file) => !restSet.has(file)).slice(0, 100);
  if (!loadFiles.length) {
    notes.push("\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B \u0444\u043E\u0442\u043E \u043F\u043E\u043B\u043E\u0441\u043E\u043A \u043F\u043E\u0441\u043B\u0435 \u043D\u0430\u0433\u0440\u0443\u0437\u043E\u043A.");
  } else {
    notes.push('\u0424\u043E\u0442\u043E "\u043F\u043E\u0441\u043B\u0435 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438" \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u044B \u0438\u0437 \u043F\u0430\u043F\u043A\u0438 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430 (\u0432\u0441\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F).');
  }
  return {
    status: "ok",
    scales: toItems(scales),
    rest: toItems(restFiles),
    load: toItems(loadFiles),
    workout: toItems(trainingFiles),
    notes,
    roots: {
      training: TRAINING_DIR,
      participant: PARTICIPANT_DIR,
      rest: REST_DIR
    }
  };
});

export { mvpDemoData_get as default };
//# sourceMappingURL=mvp-demo-data.get.mjs.map
