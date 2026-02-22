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
  index: number
  level: string        // 'L1'..'LN' — closest match on scale palette
  delta_e: number | null  // colour distance (lower = better match)
}

export type StripResult = {
  photo_filename: string  // original uploaded photo name
  strip_index: number     // always 1 — one strip per photo (deduplication applied)
  zone_count: number
  scale_id: string | null // which scale profile was matched
  zones: ZoneResult[]
}

export type OcrItem = {
  filename: string
  text: string
  warning: string | null
}

export type ScaleProfile = {
  id: string
  zone_count: number
  palette_size: number
  filename: string
}

export type CvAnalysisResult = {
  status: 'ok' | 'error'
  session_id: string | null
  strips: {
    rest: StripResult[]
    load: StripResult[]
  }
  ocr: {
    items: OcrItem[]
  }
  meta: {
    scale_profiles: ScaleProfile[]
    note: string | null
  }
  // error fields (only when status === 'error')
  error?: string
  message?: string
}

// ─── Normalizer ──────────────────────────────────────────────────────────

const mapZone = (raw: unknown, idx: number): ZoneResult => {
  const zone = asRecord(raw) || {}
  const nearest = asRecord(zone.nearest) || {}
  return {
    index: idx,
    level: asString(nearest.label) || '—',
    delta_e: asNumber(nearest.delta_e),
  }
}

const mapStrip = (raw: unknown, groupName: 'rest' | 'load'): StripResult | null => {
  const item = asRecord(raw)
  if (!item) return null

  // One physical strip per photo — take strip_index === 1.
  // CV backend may return multiple ROIs per image; we only use the first.
  const stripIndex = asNumber(item.strip_index) ?? 1
  if (stripIndex !== 1) return null

  const zones = asArray(item.zones).map((z, i) => mapZone(z, i + 1))
  return {
    photo_filename: asString(item.filename) || 'unknown',
    strip_index: 1,
    zone_count: zones.length,
    scale_id: asString(item.matched_scale_id),
    zones,
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
      strips: { rest: [], load: [] },
      ocr: { items: [] },
      meta: { scale_profiles: [], note: null },
      error: message,
      message,
    }
  }

  // ── Session ──
  const meta = asRecord(payload.meta) || {}
  const session_id = asString(meta.session_id) || asString(root.sessionId)

  // ── Scale profiles ──
  const scale_profiles: ScaleProfile[] = asArray(meta.scale_profiles)
    .map((p) => {
      const pr = asRecord(p) || {}
      return {
        id: asString(pr.id) || 'unknown',
        zone_count: asNumber(pr.count) ?? 0,
        palette_size: asNumber(pr.palette_size) ?? 0,
        filename: asString(pr.filename) || '',
      }
    })

  // ── Strips: deduplicate by photo — keep only strip_index === 1 ──
  const restStrips = asArray(asRecord(payload.rest)?.items)
    .map((item) => mapStrip(item, 'rest'))
    .filter((s): s is StripResult => s !== null)

  const loadStrips = asArray(asRecord(payload.load)?.items)
    .map((item) => mapStrip(item, 'load'))
    .filter((s): s is StripResult => s !== null)

  // ── OCR ──
  const ocrItems = asArray(asRecord(payload.ocr)?.items).map(mapOcrItem)

  return {
    status: 'ok',
    session_id,
    strips: {
      rest: restStrips,
      load: loadStrips,
    },
    ocr: { items: ocrItems },
    meta: {
      scale_profiles,
      note: asString(meta.note),
    },
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
