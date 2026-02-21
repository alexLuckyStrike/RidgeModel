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

export type MvpTestParameter = {
  value?: number | string
  unit?: string
  status?: string
}

export type MvpMedicalTest = {
  type?: string
  parameters?: Record<string, MvpTestParameter>
}

export type MvpWorkoutExercise = {
  minute?: number | string
  name?: string
  reps?: number | string
  unit?: string
}

export type MvpWorkoutResult = {
  name?: string
  type?: string
  exercises?: MvpWorkoutExercise[]
  notes?: string[]
}

export type MvpAnalysisResult = {
  status?: string
  message?: string
  error?: string
  notes?: string[]
  medical_tests?: MvpMedicalTest[]
  workout?: MvpWorkoutResult
}

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
