import { computed, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { ridgeFit, loocvLambda } from '~/utils/ridge'
import { pcaFromSamples, compositeScores } from '~/utils/pca'
import { isFilled, uid } from '~/utils/plannerHelpers'
import {
  MARKER_CORRIDORS,
  H_up_min,
  headroomDownInPC1,
} from '~/utils/markerCorridors'
import type {
  CompositeModel,
  MarkerKey,
  Plan,
  PlannedWeek,
  PlannedSession,
  VariantSettings,
  PlanVariantId,
  CorridorCheck,
} from '~/utils/plannerTypes'
import type { Athlete, RestBaseline, Row } from '~/stores/athletes'

export interface PlannerProcessingDeps {
  activeRows: ComputedRef<Record<string, Row>>
  activeRestBaseline: ComputedRef<RestBaseline>
  activeAthlete: ComputedRef<Athlete | null>
  competitionDate: ComputedRef<string>
  startDate: ComputedRef<string>
  athletes: Ref<Athlete[]>
  ensureRowsForAllAthletes: () => void
  getPlanWeeksFor: (athlete: Athlete) => number
  athletePlans: Ref<Record<string, Partial<Record<PlanVariantId, Plan>>>>
  activePlanId: Ref<PlanVariantId>
  activePlan: ComputedRef<Plan | null>
  drawCharts: () => void
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
    alphaWeek: 0.30,
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
    alphaWeek: 0.20,
    accentShares: [0.3, 0.5, 0.2],
    sessionDistribution: 'back',
    control: 'myoglobin',
    rMin: 1,
    rMax: 14,
  },
}

const DELTA_STEP = 0.01 // 1%
const DELTA_MIN_NON_ZERO = 0.01 // 1%
const DELTA_MAX_ABS = 0.65
const MIN_TARGET_MAG = DELTA_STEP * 10 // увеличен для демо: 0.10 вместо 0.03,
// чтобы недельная ΔPC1 давала видимые колебания V/P/R на графиках.

const MARKERS: MarkerKey[] = ['creatinine', 'protein', 'myoglobin', 'ketones']

type MarkerValues = Record<MarkerKey, number>

type SessionDistribution = VariantSettings['sessionDistribution']

export function usePlannerProcessing(deps: PlannerProcessingDeps) {
  // ─── Computed ───
  const hasFilledData = computed(() => {
    return Object.values(deps.activeRows.value).some(isFilled)
  })

  const canModel = computed(() => {
    return Boolean(
      deps.competitionDate.value && deps.startDate.value && hasFilledData.value
    )
  })

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

  // ─── Pure functions ───
  const markerLabel = (m: MarkerKey) =>
    m === 'creatinine' ? 'Креатинин' : m === 'protein' ? 'Белок' : m === 'myoglobin' ? 'Миоглобин' : 'Кетоны'

  const mkDelta = (x: number, x0: number) => (x - x0) / Math.max(1e-9, x0)
  const applyDelta = (x0: number, d: number) => x0 * (1 + d)
  const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))
  const quantizeStep = (x: number, step = DELTA_STEP) =>
    Math.round(x / step) * step

  const dot3 = (
    a: [number, number, number],
    b: [number, number, number]
  ) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

  const clamp3 = (
    values: [number, number, number],
    min: number,
    max: number
  ): [number, number, number] => [
    clamp(values[0], min, max),
    clamp(values[1], min, max),
    clamp(values[2], min, max),
  ]

  const normalizeShares3 = (shares: [number, number, number]) => {
    const safe: [number, number, number] = [
      Math.max(1e-6, shares[0]),
      Math.max(1e-6, shares[1]),
      Math.max(1e-6, shares[2]),
    ]
    const sum = safe[0] + safe[1] + safe[2]
    return [safe[0] / sum, safe[1] / sum, safe[2] / sum] as [number, number, number]
  }

  const ensureAllDeltasAreNonZero = (
    deltas: [number, number, number],
    signs: [number, number, number]
  ) => {
    const out: [number, number, number] = [...deltas] as [number, number, number]
    for (let i = 0; i < 3; i++) {
      if (Math.abs(out[i]) < DELTA_MIN_NON_ZERO) {
        out[i] = DELTA_MIN_NON_ZERO * (signs[i] || 1)
      }
      out[i] = clamp(quantizeStep(out[i], DELTA_STEP), -DELTA_MAX_ABS, DELTA_MAX_ABS)
      if (out[i] === 0) {
        out[i] = DELTA_MIN_NON_ZERO * (signs[i] || 1)
      }
    }
    return out
  }

  const rescaleDeltasToTarget = (
    deltasIn: [number, number, number],
    beta: [number, number, number],
    target: number
  ) => {
    const produced = dot3(beta, deltasIn)
    if (Math.abs(produced) < 1e-9) return deltasIn
    const scale = target / produced
    if (!Number.isFinite(scale) || scale === 0) return deltasIn
    return [
      deltasIn[0] * scale,
      deltasIn[1] * scale,
      deltasIn[2] * scale,
    ] as [number, number, number]
  }

  const signsByModel = (modelName: string): [number, number, number] => {
    if (modelName.includes('Объём')) return [1, 1, -1]
    if (modelName.includes('Интенсив')) return [1, -1, 1]
    return [-1, -1, 1]
  }

  const signsOf = (
    deltas: [number, number, number],
    defaultSigns: [number, number, number]
  ): [number, number, number] => [
    Math.sign(deltas[0]) || defaultSigns[0] || 1,
    Math.sign(deltas[1]) || defaultSigns[1] || 1,
    Math.sign(deltas[2]) || defaultSigns[2] || 1,
  ]

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

  const fitCompositeFor = (athlete: Athlete): CompositeModel | null => {
    const b = baselineFor(athlete)
    const allRows = Object.values(athlete.rows).filter(isFilled)

    // Need all 4 markers positive in every sample
    const samples = allRows.filter((r) =>
      MARKERS.every(
        (m) =>
          typeof r[m] === 'number' &&
          Number.isFinite(r[m] as number) &&
          (r[m] as number) > 0
      )
    )
    if (samples.length < 6) return null

    try {
      const lnRatios = samples.map((r) =>
        MARKERS.map((m) => {
          const y0 = getRestY0For(athlete, m)
          return Math.log((r[m] as number) / y0)
        })
      )

      const pca = pcaFromSamples(lnRatios)
      const z = compositeScores(lnRatios, pca)

      const X = samples.map((r) => [
        mkDelta(r.V as number, b.V),
        mkDelta(r.P as number, b.P),
        mkDelta(r.R as number, b.R),
      ])

      const lambda = loocvLambda(X, z)
      const ridge = ridgeFit(X, z, lambda)

      if (!Number.isFinite(ridge.beta[2]) || Math.abs(ridge.beta[2]) < 0.02)
        return null

      return {
        ridge: {
          beta: ridge.beta as [number, number, number],
          lambda: ridge.lambda,
          r2: ridge.r2,
        },
        pca: {
          weights: pca.weights as [number, number, number, number],
          means: pca.means as [number, number, number, number],
          explainedRatio: pca.explainedRatio,
        },
      }
    } catch {
      return null
    }
  }

  const pickModel = (weekIndexZero: number, totalWeeks: number) => {
    const w = weekIndexZero + 1
    const last = totalWeeks
    if (w >= last - 1) return 'Пиковый (taper)'
    if (w % 4 === 0) return 'Восстановительный'
    if (w % 2 === 0) return 'Интенсивностный'
    return 'Объёмный'
  }

  const buildWorkout = (focus: string, V: number, P: number) => {
    const round5 = (x: number) => Math.round(x / 5) * 5
    const mainPct = focus === 'Сила' ? 0.82 : focus === 'Объём' ? 0.7 : 0.6
    const mainReps = focus === 'Сила' ? '5×3' : focus === 'Объём' ? '5×6' : '3×5'
    const benchReps = focus === 'Сила' ? '5×3' : focus === 'Объём' ? '4×8' : '3×6'
    const deadReps = focus === 'Сила' ? '4×2' : focus === 'Объём' ? '4×5' : '2×3'
    const avgW = V / Math.max(1, P)
    const squatW = round5(avgW / mainPct)
    const benchW = round5((avgW * 0.65) / mainPct)
    const deadW = round5((avgW * 0.9) / mainPct)

    return [
      `Присед: ${mainReps} @ ~${squatW} кг`,
      `Жим: ${benchReps} @ ~${benchW} кг`,
      `Тяга: ${deadReps} @ ~${deadW} кг`,
      `Аксессуары: 2–3 упражнения по 3–4 подхода (спина/трицепс/задняя цепь)`,
    ].join('\n')
  }

  const distributionWeights = (
    n: number,
    distribution: SessionDistribution
  ): number[] => {
    if (n <= 1) return [1]
    if (distribution === 'even') return Array.from({ length: n }, () => 1 / n)

    const normalize = (weights: number[]) => {
      const safe = weights.map((w) => Math.max(0, w))
      const sum = safe.reduce((a, b) => a + b, 0)
      if (sum <= 0) return Array.from({ length: n }, () => 1 / n)
      return safe.map((w) => w / sum)
    }

    if (distribution === 'front') {
      if (n === 4) return [0.35, 0.3, 0.25, 0.1]
      const weights = Array.from({ length: n }, (_, i) => n - i)
      return normalize(weights)
    }

    if (distribution === 'back') {
      if (n === 4) return [0.1, 0.25, 0.3, 0.35]
      const weights = Array.from({ length: n }, (_, i) => i + 1)
      return normalize(weights)
    }

    if (n === 4) return [0.3, 0.3, 0.3, 0.1]
    if (n === 3) return [0.35, 0.35, 0.3]
    if (n === 2) return [0.6, 0.4]

    const weights = Array.from({ length: n }, (_, i) => (i === n - 1 ? 0.1 : 0.9 / (n - 1)))
    return normalize(weights)
  }

  const distributePC1ToSessions = (
    weekTarget: number,
    nSessions: number,
    distribution: SessionDistribution
  ) => {
    const weights = distributionWeights(nSessions, distribution)
    return weights.map((w) => weekTarget * w)
  }

  const sessionDeltasFromTarget = (
    targetEffect: number,
    accentShares: [number, number, number],
    beta: [number, number, number],
    modelName: string
  ) => {
    const targetMagnitude = Math.max(Math.abs(targetEffect), MIN_TARGET_MAG)
    const shares = normalizeShares3(accentShares)
    const baseSigns = signsByModel(modelName)
    const betaAbsSafe: [number, number, number] = [
      Math.max(Math.abs(beta[0]), 1e-3),
      Math.max(Math.abs(beta[1]), 1e-3),
      Math.max(Math.abs(beta[2]), 1e-3),
    ]

    let deltas: [number, number, number] = [
      (baseSigns[0] * shares[0] * targetMagnitude) / betaAbsSafe[0],
      (baseSigns[1] * shares[1] * targetMagnitude) / betaAbsSafe[1],
      (baseSigns[2] * shares[2] * targetMagnitude) / betaAbsSafe[2],
    ]

    deltas = rescaleDeltasToTarget(deltas, beta, targetEffect)

    return { deltas, baseSigns }
  }

  const markerValuesFromBaseline = (
    baseState: ReturnType<typeof baselineFor>
  ): MarkerValues => ({
    creatinine: Math.max(1e-9, baseState.creatinine),
    protein: Math.max(1e-9, baseState.protein),
    myoglobin: Math.max(1e-9, baseState.myoglobin),
    ketones: Math.max(1e-9, baseState.ketones),
  })

  const markerRestValuesForAthlete = (athlete: Athlete): MarkerValues => ({
    creatinine: Math.max(1e-9, getRestY0For(athlete, 'creatinine')),
    protein: Math.max(1e-9, getRestY0For(athlete, 'protein')),
    myoglobin: Math.max(1e-9, getRestY0For(athlete, 'myoglobin')),
    ketones: Math.max(1e-9, getRestY0For(athlete, 'ketones')),
  })

  const weeklyPC1Target = (
    settings: VariantSettings,
    modelName: string,
    composite: CompositeModel,
    currentMarkers: MarkerValues,
    restMarkers: MarkerValues
  ) => {
    const isRecoveryDirection =
      modelName.includes('Восстанов') || modelName.includes('Пиковый')

    const up = H_up_min(currentMarkers, restMarkers, composite.pca, MARKER_CORRIDORS)
    const down = headroomDownInPC1(
      currentMarkers,
      restMarkers,
      composite.pca,
      MARKER_CORRIDORS
    )

    const corridorHeadroom = isRecoveryDirection ? down : up.value
    if (!Number.isFinite(corridorHeadroom) || corridorHeadroom <= 0) return 0

    const sign = isRecoveryDirection ? -1 : 1
    const raw = sign * settings.alphaWeek * corridorHeadroom
    const minMag = Math.min(MIN_TARGET_MAG, corridorHeadroom)
    if (Math.abs(raw) < minMag) return sign * minMag
    return raw
  }

  const predictMarkers = (
    deltas: [number, number, number],
    restMarkers: MarkerValues,
    composite: CompositeModel,
    beta: [number, number, number]
  ) => {
    const pc1 = dot3(beta, deltas)
    const predicted: Record<MarkerKey, number> = {
      creatinine: 0,
      protein: 0,
      myoglobin: 0,
      ketones: 0,
    }

    MARKERS.forEach((marker, idx) => {
      const x = composite.pca.means[idx] + composite.pca.weights[idx] * pc1
      predicted[marker] = Math.exp(x) * restMarkers[marker]
    })

    return { pc1, predicted }
  }

  const checkCorridor = (
    predicted: Partial<Record<MarkerKey, number>>
  ): CorridorCheck => {
    const violations: CorridorCheck['violations'] = []

    for (const marker of MARKERS) {
      const value = predicted[marker]
      if (value === undefined) continue
      const corridor = MARKER_CORRIDORS[marker]
      if (!Number.isFinite(value) || value < corridor.low || value > corridor.high) {
        violations.push({
          marker,
          predicted: Number.isFinite(value) ? value : Number.NaN,
          low: corridor.low,
          high: corridor.high,
        })
      }
    }

    return {
      ok: violations.length === 0,
      violations,
    }
  }

  const buildPlan = (athlete: Athlete, variantId: PlanVariantId): Plan | null => {
    const base = baselineFor(athlete)
    const restMarkers = markerRestValuesForAthlete(athlete)
    const currentMarkers = markerValuesFromBaseline(base)
    const total = deps.getPlanWeeksFor(athlete)
    if (total <= 0) return null

    const settings = VARIANT_DEFAULTS[variantId]
    const accentShares = normalizeShares3(settings.accentShares)
    const composite = fitCompositeFor(athlete)
    if (!composite) return null
    const betaVector: [number, number, number] =
      composite.ridge.beta as [number, number, number]

    const clampR = (x: number) => {
      const a = Math.min(settings.rMin, settings.rMax)
      const b = Math.max(settings.rMin, settings.rMax)
      return Math.min(b, Math.max(a, x))
    }

    const out: PlannedWeek[] = []
    for (let i = 0; i < total; i++) {
      const modelName = pickModel(i, total)
      const focus = modelName.includes('Восстанов')
        ? 'Техника'
        : modelName.includes('Объём')
        ? 'Объём'
        : 'Сила'

      const weekTarget = weeklyPC1Target(
        settings,
        modelName,
        composite,
        currentMarkers,
        restMarkers
      )

      const sessionTargets = distributePC1ToSessions(
        weekTarget,
        athlete.period.sessionsPerWeek,
        settings.sessionDistribution
      )

      const sessions: PlannedSession[] = []
      for (let s = 0; s < athlete.period.sessionsPerWeek; s++) {
        const target = sessionTargets[s] ?? 0

        let deltas: [number, number, number] = [0, 0, 0]
        if (Math.abs(target) > 1e-9) {
          const seeded = sessionDeltasFromTarget(
            target,
            accentShares,
            betaVector,
            modelName
          )
          deltas = seeded.deltas
          const signs = signsOf(deltas, seeded.baseSigns)

          deltas = clamp3(deltas, -DELTA_MAX_ABS, DELTA_MAX_ABS)
          deltas = ensureAllDeltasAreNonZero(deltas, signs)
          deltas = rescaleDeltasToTarget(deltas, betaVector, target)
          deltas = [
            clamp(quantizeStep(deltas[0], DELTA_STEP), -DELTA_MAX_ABS, DELTA_MAX_ABS),
            clamp(quantizeStep(deltas[1], DELTA_STEP), -DELTA_MAX_ABS, DELTA_MAX_ABS),
            clamp(quantizeStep(deltas[2], DELTA_STEP), -DELTA_MAX_ABS, DELTA_MAX_ABS),
          ]
        }

        const [dV, dP, dR] = deltas
        const V = Math.max(0, Math.round(base.V * (1 + dV)))
        const P = Math.max(10, Math.round(base.P * (1 + dP)))

        const Rraw = applyDelta(base.R, dR)
        const Rclamped = clampR(Rraw)
        const R = Math.round(Rclamped * 10) / 10
        const rWarn = !Number.isFinite(Rraw) || Rclamped !== Rraw

        let pc1Predicted = dot3(betaVector, deltas)
        let markersPredicted: Partial<Record<MarkerKey, number>> = {}
        let corridor: CorridorCheck = { ok: true, violations: [] }

        const predicted = predictMarkers(deltas, restMarkers, composite, betaVector)
        pc1Predicted = predicted.pc1
        markersPredicted = predicted.predicted
        corridor = checkCorridor(predicted.predicted)

        const warn = rWarn || !corridor.ok

        sessions.push({
          id: uid(),
          week: i + 1,
          session: s + 1,
          focus,
          model: modelName,
          V,
          P,
          R,
          workout: buildWorkout(focus, V, P),
          flag: warn ? 'Внимание' : 'OK',
          pc1Predicted,
          markersPredicted,
          corridor,
        })
      }

      out.push({ week: i + 1, model: modelName, sessions })
    }

    return {
      createdAt: new Date().toISOString(),
      competitionDate: deps.competitionDate.value || undefined,
      weeks: out,
    }
  }

  const model = async () => {
    deps.ensureRowsForAllAthletes()
    const next: Record<string, Partial<Record<PlanVariantId, Plan>>> = {
      ...deps.athletePlans.value,
    }

    deps.athletes.value.forEach((athlete) => {
      next[athlete.id] = {
        balanced: buildPlan(athlete, 'balanced') || undefined,
        volume: buildPlan(athlete, 'volume') || undefined,
        intensity: buildPlan(athlete, 'intensity') || undefined,
        recovery: buildPlan(athlete, 'recovery') || undefined,
        performance: buildPlan(athlete, 'performance') || undefined,
      }
    })

    deps.athletePlans.value = next
    deps.activePlanId.value = deps.activePlanId.value || 'balanced'

    await nextTick()
    deps.drawCharts()
  }

  return {
    // computed
    hasFilledData,
    canModel,
    planWeeks,
    baseline,
    flatPlan,
    // functions
    markerLabel,
    baselineFor,
    mkDelta,
    applyDelta,
    getRestY0For,
    fitCompositeFor,
    buildPlan,
    pickModel,
    buildWorkout,
    model,
  }
}
