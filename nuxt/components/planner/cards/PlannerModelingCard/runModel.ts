import { nextTick } from 'vue'
import type { Athlete } from '../../../../stores/athletes'
import { useDataPreperationPCAStore } from '../../../../stores/DataPreperationPCA'
import type { Plan, PlanVariantId } from '../../../../utils/plannerTypes'
import { logRelativeToBaseLine } from './PlannerModelingCard.helpers'

export async function runModel(params: {
  athletes: Athlete[]
  athletePlans: Record<string, Partial<Record<PlanVariantId, Plan>>>
  activePlanId: PlanVariantId
  ensureRowsForAllAthletes: () => void
  applyModel: (
    plans: Record<string, Partial<Record<PlanVariantId, Plan>>>,
    planId: PlanVariantId
  ) => void
  drawCharts: () => void
}) {
  const dataPreperationPCAStore = useDataPreperationPCAStore()
  const athletesDataAll = await dataPreperationPCAStore.fetchAllAthletesFromDb()

  // console.log('athletesDataAll:', athletesDataAll)

  const relativeMarkersFromBaselineByAthletes = athletesDataAll.map((athlete) => ({
    athleteId: athlete.id,
    name: athlete.name,
    rows: logRelativeToBaseLine(athlete.rows, athlete.restBaseline),
  }))

  console.log('relativeMarkersFromBaselineByAthletes:', relativeMarkersFromBaselineByAthletes)
  ///// Неясно для чего эта функция

  params.ensureRowsForAllAthletes()

  const next: Record<string, Partial<Record<PlanVariantId, Plan>>> = {
    ...params.athletePlans,
  }

  params.athletes.forEach((athlete) => {
    next[athlete.id] = {}
  })

  const planId: PlanVariantId = params.activePlanId || 'balanced'
  params.applyModel(next, planId)

  await nextTick()
  params.drawCharts()
}
