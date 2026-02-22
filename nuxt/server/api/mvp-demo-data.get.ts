import fs from 'fs/promises'
import path from 'path'

type DemoItem = {
  name: string
  path: string
}

const DESKTOP_ROOT = '/Users/admin/Desktop'
const TRAINING_DIR = '/Users/admin/Desktop/training'
const PARTICIPANT_DIR = '/Users/admin/Desktop/Артем Путинцев Участник1'
const REST_DIR = '/Users/admin/Desktop/Артем Путинцев Участник1/Без нагрузки'
const REST_PINNED_FILES = [
  '/Users/admin/Desktop/Артем Путинцев Участник1/Без нагрузки/photo_2026-02-02_21-08-05.jpg',
]

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp'])
const TEXT_EXTS = new Set(['.txt', '.md', '.png', '.jpg', '.jpeg'])

const ext = (filePath: string) => path.extname(filePath).toLowerCase()
const isImage = (filePath: string) => IMAGE_EXTS.has(ext(filePath))
const isWorkoutInfo = (filePath: string) => TEXT_EXTS.has(ext(filePath))

const sortByName = (files: string[]) => files.sort((a, b) => a.localeCompare(b, 'ru'))

async function exists(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function listFiles(dir: string, recursive = false): Promise<string[]> {
  if (!(await exists(dir))) return []
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const abs = path.join(dir, entry.name)
    if (entry.isFile()) {
      out.push(abs)
      continue
    }
    if (recursive && entry.isDirectory()) {
      out.push(...(await listFiles(abs, true)))
    }
  }
  return out
}

async function pickScaleFiles(): Promise<string[]> {
  const topFiles = await listFiles(DESKTOP_ROOT, false)
  const jpegOnly = topFiles.filter((file) => ['.jpeg', '.jpg'].includes(ext(file)))
  const dated = await Promise.all(
    jpegOnly.map(async (file) => ({
      file,
      mtime: (await fs.stat(file)).mtimeMs,
    }))
  )
  return dated
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 2)
    .map((item) => item.file)
}

function toItems(files: string[]): DemoItem[] {
  return files.map((file) => ({
    name: path.basename(file),
    path: file,
  }))
}

export default defineEventHandler(async () => {
  const notes: string[] = []

  const scales = await pickScaleFiles()
  if (scales.length < 2) {
    notes.push('Найдено меньше двух JPEG-файлов для шкал на Desktop.')
  }

  const trainingFiles = sortByName((await listFiles(TRAINING_DIR, true)).filter(isWorkoutInfo))
  if (!trainingFiles.length) {
    notes.push('Папка training не содержит файлов для блока "Нагрузка".')
  }

  const restFilesExplicit = sortByName((await listFiles(REST_DIR, true)).filter(isImage))
  const participantAllImages = sortByName((await listFiles(PARTICIPANT_DIR, true)).filter(isImage))
  const pinnedRestFiles = (
    await Promise.all(
      REST_PINNED_FILES.map(async (file) => ((await exists(file)) ? file : null))
    )
  ).filter((file): file is string => Boolean(file))

  const restFiles = Array.from(new Set([
    ...pinnedRestFiles,
    ...restFilesExplicit,
  ])).slice(0, 2)

  if (pinnedRestFiles.length) {
    notes.push(`Фото для "Покой" закреплены вручную: ${pinnedRestFiles.map((f) => path.basename(f)).join(', ')}`)
  }
  if (!restFiles.length) {
    notes.push('Папка "Без нагрузки" пуста. Блок "Покой" не заполнен автоматически.')
  }

  // As requested: all images in participant folder are treated as "after load".
  const restSet = new Set(restFiles)
  const loadFiles = participantAllImages
    .filter((file) => !restSet.has(file))
    .slice(0, 100)

  if (!loadFiles.length) {
    notes.push('Не найдены фото полосок после нагрузок.')
  } else {
    notes.push('Фото "после нагрузки" загружены из папки участника (все найденные изображения).')
  }

  return {
    status: 'ok',
    scales: toItems(scales),
    rest: toItems(restFiles),
    load: toItems(loadFiles),
    workout: toItems(trainingFiles),
    notes,
    roots: {
      training: TRAINING_DIR,
      participant: PARTICIPANT_DIR,
      rest: REST_DIR,
    },
  }
})
