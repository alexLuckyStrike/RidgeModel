import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { isFilled } from '~/utils/plannerHelpers'
import type {
  CompositeModel,
  MarkerKey,
  Plan,
  VariantSettings,
  PlanVariantId,
} from '~/utils/plannerTypes'
import type { Athlete, RestBaseline, Row } from '~/stores/athletes'

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

}
