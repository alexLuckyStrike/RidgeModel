import { defineStore } from 'pinia'
import { ref } from 'vue'

export type MvpPreview = {
  id: string
  file: File
  url: string
  name: string
  size: number
}

export type MvpLoad5Set = {
  id: string
  first: MvpPreview | null
  second: MvpPreview | null
  workoutPhoto: MvpPreview | null
  workoutText: MvpPreview | null
}

// ─── Contract types (mirrors nuxt/server/api/cv-analyze.post.ts) ─────────

export type MedicalTestResult = {
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

export type MvpAnalysisResult = {
  status: 'ok' | 'error'
  session_id: string | null
  medical_tests: MedicalTestResult[]
  workout: {
    notes: string[]
  }
  error?: string
  message?: string
}

// ─── Store ───────────────────────────────────────────────────────────────

const createId = () => {
  try {
    const c = globalThis.crypto as Crypto | undefined
    return c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

const createEmptySet = (): MvpLoad5Set => ({
  id: createId(),
  first: null,
  second: null,
  workoutPhoto: null,
  workoutText: null,
})

export const useMvpStore = defineStore('mvp', () => {
  const load5Sets = ref<MvpLoad5Set[]>([createEmptySet()])
  const analysisResult = ref<MvpAnalysisResult | null>(null)

  const addLoad5Set = () => {
    load5Sets.value.push(createEmptySet())
  }

  const removeLoad5Set = (setId: string) => {
    const index = load5Sets.value.findIndex((item) => item.id === setId)
    if (index !== -1) load5Sets.value.splice(index, 1)
  }

  const resetLoad5Sets = () => {
    load5Sets.value = [createEmptySet()]
  }

  const setAnalysisResult = (payload: MvpAnalysisResult | null) => {
    analysisResult.value = payload
  }

  const clearAnalysisResult = () => {
    analysisResult.value = null
  }

  return {
    load5Sets,
    analysisResult,
    addLoad5Set,
    removeLoad5Set,
    resetLoad5Sets,
    setAnalysisResult,
    clearAnalysisResult,
  }
})
