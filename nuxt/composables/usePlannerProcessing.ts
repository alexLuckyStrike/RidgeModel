import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { Athlete, RestBaseline, Row } from '~/stores/athletes'
import type { Plan } from '~/utils/plannerTypes'

export interface PlannerProcessingDeps {
  activeRows: ComputedRef<Record<string, Row>>
  activeRestBaseline: ComputedRef<RestBaseline>
  activeAthlete: ComputedRef<Athlete | null>
  competitionDate: ComputedRef<string>
  startDate: ComputedRef<string>
  getPlanWeeksFor: (athlete: Athlete) => number
  activePlan: ComputedRef<Plan | null>
}

export function usePlannerProcessing(deps: PlannerProcessingDeps) {
  // Заглушка до полноценной переработки вычислительной модели.
  const hasFilledData = computed(() => false)
  const canModel = computed(() => false)
  const flatPlan = computed(() =>
    deps.activePlan.value ? deps.activePlan.value.weeks.flatMap((week) => week.sessions) : []
  )


  
  return {
    hasFilledData,
    canModel,
    flatPlan,
  }
}
