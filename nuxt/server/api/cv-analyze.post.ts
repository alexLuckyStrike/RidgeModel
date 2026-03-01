import { createError, readMultipartFormData } from 'h3'

// ─── Helpers ────────────────────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>

const asRecord = (v: unknown): UnknownRecord | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as UnknownRecord) : null

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

const asNumber = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const asNumberRecord = (v: unknown): Record<string, number> => {
  const rec = asRecord(v) || {}
  const out: Record<string, number> = {}
  for (const [k, value] of Object.entries(rec)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[k] = value
  }
  return out
}

const asStringRecord = (v: unknown): Record<string, string> => {
  const rec = asRecord(v) || {}
  const out: Record<string, string> = {}
  for (const [k, value] of Object.entries(rec)) {
    if (typeof value === 'string' && value.trim()) out[k] = value.trim()
  }
  return out
}

// ─── Field name mapping: frontend → CV backend ────────────────────────────
// Frontend sends: rest2_0, rest2_1, load5_0_a, load5_0_b, workout_photo_0, workout_text_0
// CV backend expects: rest2 (array), load5 (array), workout (array), text (array)

const mapFieldName = (name: string): string => {
  if (name.startsWith('rest2_')) return 'rest2'
  if (name.startsWith('rest5_')) return 'rest5'
  if (name.startsWith('load5_')) return 'load5'
  if (name.startsWith('load2_')) return 'load2'
  if (name.startsWith('workout_photo_')) return 'workout'
  if (name.startsWith('workout_text_')) return 'text'
  return name
}

// ─── Contract types (shared with frontend and future mobile) ─────────────

export type ZoneResult = {
  source: 'rest' | 'load'
  photo_filename: string
  strip_index: number
  results: Record<string, number>
  units: Record<string, string>
}

export type OcrItem = {
  filename: string
  text: string
  warning: string | null
}

export type CvAnalysisResult = {
  status: 'ok' | 'error'
  session_id: string | null
  medical_tests: ZoneResult[]
  workout: {
    notes: string[]
  }
  // error fields (only when status === 'error')
  error?: string
  message?: string
}

// ─── Normalizer ──────────────────────────────────────────────────────────

const mapMedical = (raw: unknown, source: 'rest' | 'load'): ZoneResult | null => {
  const item = asRecord(raw)
  if (!item) return null
  return {
    source,
    photo_filename: asString(item.filename) || 'unknown',
    strip_index: asNumber(item.strip_index) ?? 1,
    results: asNumberRecord(item.results),
    units: asStringRecord(item.units),
  }
}

const mapOcrItem = (raw: unknown): OcrItem => {
  const item = asRecord(raw) || {}
  return {
    filename: asString(item.filename) || 'unknown',
    text: asString(item.text) || '',
    warning: asString(item.warning),
  }
}

const normalizeCvResponse = (rawResponse: unknown): CvAnalysisResult => {
  const root = asRecord(rawResponse) || {}
  // CV backend wraps result in { ok, sessionId, result: { ... } }
  const payload = asRecord(root.result) || root

  // ── Error handling ──
  const isError = root.ok === false || payload.ok === false
    || Boolean(asString(root.error) || asString(payload.error))

  if (isError) {
    const message = asString(payload.error) || asString(root.error)
      || asString(payload.message) || asString(root.message)
      || 'CV analyze failed'
    return {
      status: 'error',
      session_id: null,
      medical_tests: [],
      workout: { notes: [] },
      error: message,
      message,
    }
  }

  // ── Session ──
  const meta = asRecord(payload.meta) || {}
  const session_id = asString(meta.session_id) || asString(root.sessionId)

  // ── Numeric medical results ──
  const restItems = asArray(asRecord(payload.rest)?.items)
    .map((item) => mapMedical(item, 'rest'))
    .filter((s): s is ZoneResult => s !== null)
  const loadItems = asArray(asRecord(payload.load)?.items)
    .map((item) => mapMedical(item, 'load'))
    .filter((s): s is ZoneResult => s !== null)

  // ── Workout notes from OCR text ──
  const notes = asArray(asRecord(payload.ocr)?.items)
    .map(mapOcrItem)
    .map((x) => x.text)
    .filter((x) => !!x)

  return {
    status: 'ok',
    session_id,
    medical_tests: [...restItems, ...loadItems],
    workout: { notes },
  }
}

// ─── Event handler ───────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const base = config.cvBackendBase || 'http://localhost:4000'

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'No files provided' })
  }

  const form = new FormData()
  for (const part of parts) {
    if (!part.name) continue
    const mappedName = mapFieldName(part.name)
    const blob = new Blob([part.data], { type: part.type || 'application/octet-stream' })
    form.append(mappedName, blob, part.filename || mappedName)
  }

  try {
    const res = await $fetch.raw(`${base}/api/analyze`, {
      method: 'POST',
      body: form,
    })

    return normalizeCvResponse(res._data)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'CV backend request failed'
    throw createError({
      statusCode: 502,
      statusMessage: 'CV backend error',
      message,
    })
  }
})
