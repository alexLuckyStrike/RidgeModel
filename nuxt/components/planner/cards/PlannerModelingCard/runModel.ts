import { nextTick } from 'vue'
import type { Athlete } from '../../../../stores/athletes'
import type { Plan, PlanVariantId } from '../../../../utils/plannerTypes'

export async function runModel(params: {
  athletes: Athlete[]
  athletePlans: Record<string, Partial<Record<PlanVariantId, Plan>>>
  activePlanId: PlanVariantId
  ensureRowsForAllAthletes: () => void
  applyModel: (plans: Record<string, Partial<Record<PlanVariantId, Plan>>>, planId: PlanVariantId) => void
  drawCharts: () => void
}) {
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
