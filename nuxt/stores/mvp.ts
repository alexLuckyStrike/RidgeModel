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

  return { load5Sets, addLoad5Set, removeLoad5Set, resetLoad5Sets }
})
