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

export const VARIANT_DEFAULTS: Record<PlanVariantId, VariantSettings> = {
  balanced: {
    alphaWeek: 0.25,
    accentShares: [0.4, 0.35, 0.25],
    sessionDistribution: 'even',
    control: 'protein',
    rMin: 1,
    rMax: 12,
  },
  volume: {
    alphaWeek: 0.35,
    accentShares: [0.65, 0.22, 0.13],
    sessionDistribution: 'front',
    control: 'myoglobin',
    rMin: 1,
    rMax: 12,
  },
  intensity: {
    alphaWeek: 0.3,
    accentShares: [0.25, 0.45, 0.3],
    sessionDistribution: 'front',
    control: 'creatinine',
    rMin: 1,
    rMax: 12,
  },
  recovery: {
    alphaWeek: 0.15,
    accentShares: [0.2, 0.25, 0.55],
    sessionDistribution: 'plateau-deload',
    control: 'protein',
    rMin: 1,
    rMax: 14,
  },
  performance: {
    alphaWeek: 0.2,
    accentShares: [0.3, 0.5, 0.2],
    sessionDistribution: 'back',
    control: 'myoglobin',
    rMin: 1,
    rMax: 14,
  },
}

export function usePlannerProcessing(deps: PlannerProcessingDeps) {
  const hasFilledData = computed(() => {
    return Object.values(deps.activeRows.value).some(isFilled)
  })

  // Расчеты временно отключены для полной переработки модели.
  const canModel = computed(() => false)

  const planWeeks = computed(() => {
    if (!deps.activeAthlete.value) return 0
    return deps.getPlanWeeksFor(deps.activeAthlete.value)
  })

  const baseline = computed(() => {
    const all = Object.values(deps.activeRows.value).filter(isFilled)
    const avg = (k: keyof Row) => {
      const vals = all
        .map((r) => r[k])
        .filter((v): v is number => typeof v === 'number')
      if (!vals.length) return null
      return vals.reduce((a, b) => a + b, 0) / vals.length
    }

    return {
      V: avg('V') ?? 8000,
      P: avg('P') ?? 60,
      R: avg('R') ?? 4.0,
      creatinine: avg('creatinine') ?? 5.0,
      protein: avg('protein') ?? 2.0,
      myoglobin: avg('myoglobin') ?? 20.0,
      ketones: avg('ketones') ?? 0.5,
    }
  })

  const flatPlan = computed(() =>
    deps.activePlan.value ? deps.activePlan.value.weeks.flatMap((w) => w.sessions) : []
  )

  const markerLabel = (m: MarkerKey) =>
    m === 'creatinine'
      ? 'Креатинин'
      : m === 'protein'
      ? 'Белок'
      : m === 'myoglobin'
      ? 'Миоглобин'
      : 'Кетоны'

  const mkDelta = (x: number, x0: number) => (x - x0) / Math.max(1e-9, x0)
  const applyDelta = (x0: number, d: number) => x0 * (1 + d)

  const baselineFor = (athlete: Athlete) => {
    const all = Object.values(athlete.rows).filter(isFilled)
    const avg = (k: keyof Row) => {
      const vals = all
        .map((r) => r[k])
        .filter((v): v is number => typeof v === 'number')
      if (!vals.length) return null
      return vals.reduce((a, b) => a + b, 0) / vals.length
    }

    return {
      V: avg('V') ?? 8000,
      P: avg('P') ?? 60,
      R: avg('R') ?? 4.0,
      creatinine: avg('creatinine') ?? 5.0,
      protein: avg('protein') ?? 2.0,
      myoglobin: avg('myoglobin') ?? 20.0,
      ketones: avg('ketones') ?? 0.5,
    }
  }

  const getRestY0For = (athlete: Athlete, m: MarkerKey): number => {
    const r = athlete.restBaseline[m]
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r
    const b = baselineFor(athlete)[m]
    return typeof b === 'number' && Number.isFinite(b) && b > 0 ? b : 1
  }

  const fitCompositeFor = (_athlete: Athlete): CompositeModel | null => {
    return null
  }

  const pickModel = (weekIndexZero: number, totalWeeks: number) => {
    const w = weekIndexZero + 1
    const last = totalWeeks
    if (w >= last - 1) return 'Пиковый (taper)'
    if (w % 4 === 0) return 'Восстановительный'
    if (w % 2 === 0) return 'Интенсивностный'
    return 'Объёмный'
  }

  const buildWorkout = (focus: string, _V: number, _P: number) => {
    if (focus === 'Сила') {
      return [
        'Присед: 5x3',
        'Жим: 5x3',
        'Тяга: 4x2',
      ].join('\n')
    }

    if (focus === 'Объём') {
      return [
        'Присед: 5x6',
        'Жим: 4x8',
        'Тяга: 4x5',
      ].join('\n')
    }

    return [
      'Техника: 3x5',
      'Легкий жим: 3x6',
      'Легкая тяга: 2x3',
    ].join('\n')
  }

  const buildPlan = (_athlete: Athlete, _variantId: PlanVariantId): Plan | null => {
    return null
  }

  return {
    hasFilledData,
    canModel,
    planWeeks,
    baseline,
    flatPlan,
    markerLabel,
    baselineFor,
    mkDelta,
    applyDelta,
    getRestY0For,
    fitCompositeFor,
    buildPlan,
    pickModel,
    buildWorkout,
  }
}
