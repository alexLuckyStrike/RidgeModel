import { defineStore } from 'pinia'
import { useRuntimeConfig } from 'nuxt/app'
import type { Athlete, Row } from './athletes'

type DbRow = Partial<Record<keyof Row, unknown>>

type DbAthlete = {
  id?: unknown
  name?: unknown
  period?: {
    observationWeeks?: unknown
    sessionsPerWeek?: unknown
    startDate?: unknown
    competitionDate?: unknown
  } | null
  rows?: Record<string, DbRow> | null
  restBaseline?: {
    creatinine?: unknown
    protein?: unknown
    myoglobin?: unknown
    ketones?: unknown
  } | null
}

const toNum = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const mapDbAthletes = (sourceList: DbAthlete[]): Athlete[] =>
  sourceList.map((source, idx) => {
    const rows: Record<string, Row> = {}

    for (const [key, row] of Object.entries(source?.rows || {})) {
      const r: DbRow = row || {}
      rows[key] = {
        V: toNum(r.V),
        P: toNum(r.P),
        R: toNum(r.R),
        creatinine: toNum(r.creatinine),
        protein: toNum(r.protein),
        myoglobin: toNum(r.myoglobin),
        ketones: toNum(r.ketones),
      }
    }

    return {
      id:
        typeof source?.id === 'string' && source.id.trim()
          ? source.id
          : `db-athlete-${idx + 1}`,
      name:
        typeof source?.name === 'string' && source.name.trim()
          ? source.name
          : `Спортсмен ${idx + 1}`,
      period: {
        observationWeeks: Number(source?.period?.observationWeeks) || 4,
        sessionsPerWeek: Number(source?.period?.sessionsPerWeek) || 3,
        startDate:
          (typeof source?.period?.startDate === 'string' && source.period.startDate) ||
          new Date().toISOString().slice(0, 10),
        competitionDate:
          (typeof source?.period?.competitionDate === 'string' &&
            source.period.competitionDate) ||
          '',
      },
      rows,
      restBaseline: {
        creatinine: toNum(source?.restBaseline?.creatinine),
        protein: toNum(source?.restBaseline?.protein),
        myoglobin: toNum(source?.restBaseline?.myoglobin),
        ketones: toNum(source?.restBaseline?.ketones),
      },
    }
  })

export const useDataPreperationPCAStore = defineStore('dataPreperationPCA', {
  state: () => ({
    athletesFromDb: [] as Athlete[],
    isLoadingAthletes: false,
    athletesLoadError: null as string | null,
  }),

  actions: {
    async fetchAllAthletesFromDb(backendBaseArg?: string): Promise<Athlete[]> {
      let backendBase = backendBaseArg
      if (!backendBase) {
        const config = useRuntimeConfig()
        backendBase =
          typeof config.public.backendBase === 'string' && config.public.backendBase.trim()
            ? config.public.backendBase
            : 'http://localhost:3001'
      }

      this.isLoadingAthletes = true
      this.athletesLoadError = null

      try {
        const response = await fetch(`${backendBase}/api/db/getAllAthletes`, {
          headers: { Accept: 'application/json' },
        })

        if (!response.ok) {
          const text = await response.text()
          const message = `fetchAllAthletesFromDb HTTP ${response.status}: ${text}`
          this.athletesLoadError = message
          console.error(message)
          this.athletesFromDb = []
          return []
        }

        const json = await response.json()
        const sourceList = Array.isArray(json) ? (json as DbAthlete[]) : []
        const mapped = mapDbAthletes(sourceList)
        this.athletesFromDb = mapped
        return mapped
      } catch (error) {
        const message = `fetchAllAthletesFromDb failed: ${String(error)}`
        this.athletesLoadError = message
        console.error(message)
        this.athletesFromDb = []
        return []
      } finally {
        this.isLoadingAthletes = false
      }
    },
  },
})
