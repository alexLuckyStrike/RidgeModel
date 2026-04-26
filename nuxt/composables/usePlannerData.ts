import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAthletesStore, type Athlete, type RestBaseline, type Row } from '~/stores/athletes'
import { keyOf } from '~/utils/plannerHelpers'
import type { PlanVariantId, Plan } from '~/utils/plannerTypes'


export interface PlannerDataDeps {
  athletePlans: Ref<Record<string, Partial<Record<PlanVariantId, Plan>>>>
  destroyCharts: () => void
}

export function usePlannerData(deps: PlannerDataDeps) {
  // ─── Pinia store ───
  const athletesStore = useAthletesStore()
  const { athletes } = storeToRefs(athletesStore)
  const { setAthleteCount, setAthletes, removeAthlete } = athletesStore

  // ─── State ───
  const activeAthleteId = ref<string>('')
  const expandedWeeks = ref<number[]>([1])

  // ─── Computed ───
  const activeAthlete = computed(() => {
    if (!athletes.value.length) return null
    return (
      athletes.value.find((a) => a.id === activeAthleteId.value) ||
      athletes.value[0]
    )
  })

  const observationWeeks = computed({
    get: () => activeAthlete.value?.period.observationWeeks ?? 4,
    set: (value) => {
      if (activeAthlete.value) activeAthlete.value.period.observationWeeks = value
    },
  })

  const sessionsPerWeek = computed({
    get: () => activeAthlete.value?.period.sessionsPerWeek ?? 3,
    set: (value) => {
      if (activeAthlete.value) activeAthlete.value.period.sessionsPerWeek = value
    },
  })

  const competitionDate = computed({
    get: () => activeAthlete.value?.period.competitionDate ?? '',
    set: (value) => {
      if (activeAthlete.value) activeAthlete.value.period.competitionDate = value
    },
  })

  const startDate = computed({
    get: () =>
      activeAthlete.value?.period.startDate ??
      new Date().toISOString().slice(0, 10),
    set: (value) => {
      if (activeAthlete.value) activeAthlete.value.period.startDate = value
    },
  })

  const athleteCountModel = computed({
    get: () => athletes.value.length,
    set: (value) => setAthleteCount(value),
  })

  const activeRows = computed<Record<string, Row>>(
    () => activeAthlete.value?.rows || {}
  )

  const activeRestBaseline = computed<RestBaseline>(
    () =>
      activeAthlete.value?.restBaseline || {
        creatinine: null,
        protein: null,
        myoglobin: null,
        ketones: null,
      }
  )

  // ─── Actions ───
  const setActiveAthlete = (id: string) => {
    activeAthleteId.value = id
    expandedWeeks.value = Array.from(
      { length: observationWeeks.value },
      (_, i) => i + 1
    )
  }

  const deleteAthlete = (id: string) => {
    const wasActive = activeAthleteId.value === id
    removeAthlete(id)
    delete deps.athletePlans.value[id]
    if (wasActive) {
      const first = athletes.value[0]
      activeAthleteId.value = first ? first.id : ''
    }
    expandedWeeks.value = Array.from(
      { length: observationWeeks.value },
      (_, i) => i + 1
    )
  }

  const ensureRowsForAthlete = (athlete: Athlete) => {
    const next: Record<string, Row> = { ...athlete.rows }
    let changed = false
    const obsWeeks = athlete.period.observationWeeks
    const sessions = athlete.period.sessionsPerWeek
    for (let w = 1; w <= obsWeeks; w++) {
      for (let s = 1; s <= sessions; s++) {
        const k = keyOf(w, s)
        if (!next[k]) {
          next[k] = {
            V: null,
            P: null,
            R: null,
            creatinine: null,
            protein: null,
            myoglobin: null,
            ketones: null,
          }
          changed = true
        }
      }
    }
    // prune
    for (const k of Object.keys(next)) {
      const [w, s] = k.split('-').map(Number)
      if (w > obsWeeks || s > sessions) {
        delete next[k]
        changed = true
      }
    }
    if (changed) athlete.rows = next
  }

  const ensureRowsForAllAthletes = () => {
    athletes.value.forEach((athlete) => ensureRowsForAthlete(athlete))
  }

  const getRow = (athlete: Athlete, w: number, s: number) =>
    athlete.rows[keyOf(w, s)]

  const getPlanWeeksFor = (athlete: Athlete): number => {
    if (!athlete.period.competitionDate || !athlete.period.startDate) return 0
    const start = new Date(athlete.period.startDate)
    const end = new Date(athlete.period.competitionDate)
    const ms = end.getTime() - start.getTime()
    if (!Number.isFinite(ms) || ms <= 0) return 0
    return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)))
  }

  const applyLoadedAthletes = (payload: Athlete[]) => {
    const mapped = Array.isArray(payload) ? payload : []
    if (!mapped.length) return

    setAthletes(mapped)
    ensureRowsForAllAthletes()
    activeAthleteId.value = mapped[0]?.id || ''

    const maxWeeks = Math.max(
      ...mapped.map((a) => a.period.observationWeeks || 0),
      0
    )
    expandedWeeks.value = Array.from({ length: maxWeeks }, (_, i) => i + 1)
    deps.athletePlans.value = {}
    deps.destroyCharts()
  }

  const resetAll = () => {
    if (!activeAthlete.value) return
    activeAthlete.value.rows = {}
    ensureRowsForAthlete(activeAthlete.value)
    delete deps.athletePlans.value[activeAthlete.value.id]
    activeAthlete.value.restBaseline = {
      creatinine: null,
      protein: null,
      myoglobin: null,
      ketones: null,
    }
    deps.destroyCharts()
  }

  // ─── Watchers ───
  watch(
    () => athletes.value,
    (list) => {
      if (!list.length) {
        setAthleteCount(1)
        return
      }
      if (!activeAthleteId.value || !list.some((a) => a.id === activeAthleteId.value)) {
        activeAthleteId.value = list[0].id
      }
    },
    { immediate: true, deep: true }
  )

  watch(athletes, ensureRowsForAllAthletes, { immediate: true, deep: true })

  watch(
    () => activeAthlete.value?.period.observationWeeks,
    (n) => {
      if (!n) return
      const set = new Set(expandedWeeks.value)
      for (let w = 1; w <= n; w++) set.add(w)
      expandedWeeks.value = Array.from(set).sort((a, b) => a - b)
    }
  )

  return {
    // state
    athletes,
    activeAthleteId,
    expandedWeeks,
    // computed
    activeAthlete,
    observationWeeks,
    sessionsPerWeek,
    competitionDate,
    startDate,
    athleteCountModel,
    activeRows,
    activeRestBaseline,
    // actions
    setActiveAthlete,
    deleteAthlete,
    ensureRowsForAthlete,
    ensureRowsForAllAthletes,
    getRow,
    applyLoadedAthletes,
    resetAll,
    getPlanWeeksFor,
  }
}
