import { createError, readMultipartFormData } from 'h3'

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const mapIncomingFieldName = (fieldName: string): string => {
  if (fieldName.startsWith('rest2_')) return 'rest2'
  if (fieldName.startsWith('load5_')) return 'load5'
  if (fieldName.startsWith('workout_photo_')) return 'workout'
  if (fieldName.startsWith('workout_text_')) return 'text'
  return fieldName
}

const statusByDelta = (delta: number | null): string =>
  delta === null || delta <= 20 ? 'норма' : 'внимание'

const itemToMedicalTest = (
  rawItem: unknown,
  sourceLabel: 'Покой' | 'После нагрузки'
) => {
  const item = asRecord(rawItem) || {}
  const scaleType = asString(item.scale_type) || 'unknown'
  const zones = asArray(item.zones)
  const parameters: Record<string, { value?: string | number; unit?: string; status?: string }> = {}

  zones.forEach((zoneRaw, index) => {
    const zone = asRecord(zoneRaw) || {}
    const nearest = asRecord(zone.nearest) || {}
    const label = asString(nearest.label) || '—'
    const delta = asNumber(nearest.delta_e)
    parameters[`zone_${index + 1}`] = {
      value: label,
      unit: 'level',
      status: statusByDelta(delta),
    }
  })

  if (!zones.length) {
    parameters.result = {
      value: 'нет данных',
      unit: '',
      status: 'внимание',
    }
  }

  return {
    type: `${sourceLabel} (${scaleType})`,
    parameters,
  }
}

const buildWorkoutFromOcr = (ocrItemsRaw: unknown[]) => {
  const notes: string[] = []

  ocrItemsRaw.forEach((itemRaw, index) => {
    const item = asRecord(itemRaw) || {}
    const filename = asString(item.filename) || `image_${index + 1}`
    const text = asString(item.text)
    const warning = asString(item.warning)

    if (text) notes.push(`[${filename}] ${text}`)
    if (warning) notes.push(`[${filename}] warning: ${warning}`)
  })

  if (!notes.length) return undefined

  return {
    name: 'OCR распознавание',
    type: 'text',
    exercises: [],
    notes,
  }
}

const normalizeForPlanner = (rawResponse: unknown) => {
  const root = asRecord(rawResponse) || {}
  const payload = asRecord(root.result) || root

  const rootError = asString(root.error)
  const payloadError = asString(payload.error)
  const rootMessage = asString(root.message)
  const payloadMessage = asString(payload.message)
  const isError = root.ok === false || payload.ok === false || Boolean(rootError || payloadError)

  if (isError) {
    const message = payloadError || rootError || payloadMessage || rootMessage || 'CV analyze failed'
    return {
      status: 'error',
      error: message,
      message,
    }
  }

  const existingMedical = asArray(payload.medical_tests)
  const existingWorkout = asRecord(payload.workout)
  if (existingMedical.length || existingWorkout) {
    return {
      status: asString(payload.status) || 'ok',
      notes: asArray(payload.notes),
      medical_tests: existingMedical,
      workout: existingWorkout || undefined,
    }
  }

  const restItems = asArray(asRecord(payload.rest)?.items)
  const loadItems = asArray(asRecord(payload.load)?.items)
  const ocrItems = asArray(asRecord(payload.ocr)?.items)

  const medical_tests = [
    ...restItems.map((item) => itemToMedicalTest(item, 'Покой')),
    ...loadItems.map((item) => itemToMedicalTest(item, 'После нагрузки')),
  ]

  const notes: string[] = []
  const meta = asRecord(payload.meta)
  const metaNote = asString(meta?.note)
  if (metaNote) notes.push(metaNote)
  const sessionId = asString(meta?.session_id) || asString(root.sessionId)
  if (sessionId) notes.push(`session: ${sessionId}`)

  return {
    status: 'ok',
    notes,
    medical_tests,
    workout: buildWorkoutFromOcr(ocrItems),
  }
}

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
    const mappedName = mapIncomingFieldName(part.name)
    const blob = new Blob([part.data], { type: part.type || 'application/octet-stream' })
    form.append(mappedName, blob, part.filename || mappedName)
  }

  try {
    const res = await $fetch.raw(`${base}/api/analyze`, {
      method: 'POST',
      body: form,
    })

    return normalizeForPlanner(res._data)
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
