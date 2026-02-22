import fs from 'fs/promises'
import path from 'path'
import { createError, getQuery, setResponseHeader } from 'h3'

const ALLOWED_ROOTS = [
  '/Users/admin/Desktop/training',
  '/Users/admin/Desktop/Артем Путинцев Участник1',
  '/Users/admin/Desktop',
].map((root) => path.resolve(root))

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

const startsWithRoot = (targetPath: string, root: string) =>
  targetPath === root || targetPath.startsWith(`${root}${path.sep}`)

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rawPath = typeof query.path === 'string' ? query.path : ''
  if (!rawPath) {
    throw createError({ statusCode: 400, statusMessage: 'path query is required' })
  }

  const decoded = decodeURIComponent(rawPath)
  const resolved = path.resolve(decoded)
  const isAllowed = ALLOWED_ROOTS.some((root) => startsWithRoot(resolved, root))

  if (!isAllowed) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden file path' })
  }

  let stat
  try {
    stat = await fs.stat(resolved)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }
  if (!stat.isFile()) {
    throw createError({ statusCode: 400, statusMessage: 'Path is not a file' })
  }

  const ext = path.extname(resolved).toLowerCase()
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
  const fileData = await fs.readFile(resolved)

  setResponseHeader(event, 'content-type', mime)
  setResponseHeader(event, 'cache-control', 'no-store')
  return fileData
})
