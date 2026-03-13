import { computed, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { olsFit } from '~/utils/ols'
import { ridgeFit, loocvLambda } from '~/utils/ridge'
import { pcaFromSamples, compositeScores } from '~/utils/pca'
import { isFilled, uid } from '~/utils/plannerHelpers'
import type {
  Coeffs,
  CompositeModel,
  MarkerKey,
  Plan,
  PlannedWeek,
  PlannedSession,
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
  athletes: Ref<Athlete[]>
  ensureRowsForAllAthletes: () => void
  getPlanWeeksFor: (athlete: Athlete) => number
  athletePlans: Ref<Record<string, Partial<Record<PlanVariantId, Plan>>>>
  activePlanId: Ref<PlanVariantId>
  activePlan: ComputedRef<Plan | null>
  drawCharts: () => void
}

const VARIANT_DEFAULTS: Record<PlanVariantId, VariantSettings> = {
  balanced: {
    V: 1.0,
    P: 1.0,
    wave: 1.0,
    control: 'protein',
    targetShiftLn: 0.0,
    targetWaveLn: 0.02,
    rMin: 1,
    rMax: 12,
  },
  volume: {
    V: 1.08,
    P: 1.04,
    wave: 1.15,
    control: 'myoglobin',
    targetShiftLn: 0.0,
    targetWaveLn: 0.03,
    rMin: 1,
    rMax: 12,
  },
  intensity: {
    V: 0.96,
    P: 0.88,
    wave: 1.25,
    control: 'creatinine',
    targetShiftLn: -0.02,
    targetWaveLn: 0.03,
    rMin: 1,
    rMax: 12,
  },
  recovery: {
    V: 0.88,
    P: 1.06,
    wave: 0.85,
    control: 'protein',
    targetShiftLn: -0.03,
    targetWaveLn: 0.015,
    rMin: 1,
    rMax: 14,
  },
  performance: {
    V: 0.98,
    P: 0.84,
    wave: 1.05,
    control: 'myoglobin',
    targetShiftLn: -0.02,
    targetWaveLn: 0.02,
    rMin: 1,
    rMax: 14,
  },
}

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

  const getRestY0 = (m: MarkerKey): number => {
    const r = deps.activeRestBaseline.value[m]
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r
    const b = baseline.value[m]
    return typeof b === 'number' && Number.isFinite(b) && b > 0 ? b : 1
  }

  const getRestY0For = (athlete: Athlete, m: MarkerKey): number => {
    const r = athlete.restBaseline[m]
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r
    const b = baselineFor(athlete)[m]
    return typeof b === 'number' && Number.isFinite(b) && b > 0 ? b : 1
  }

  const defaultCoeffs = (m: MarkerKey): Coeffs => {
    const b = baseline.value
    const yTrain0 = b[m]
    const yRest0 = getRestY0(m)
    const b0 = Math.log(Math.max(1e-9, yTrain0) / Math.max(1e-9, yRest0))
    if (m === 'myoglobin') return { b0, b1: 0.85, b2: 0.25, b3: -0.55 }
    if (m === 'protein') return { b0, b1: 0.45, b2: 0.35, b3: -0.4 }
    if (m === 'ketones') return { b0, b1: 0.7, b2: 0.3, b3: -0.5 }
    return { b0, b1: 0.3, b2: 0.55, b3: -0.35 }
  }

  const defaultCoeffsFor = (athlete: Athlete, m: MarkerKey): Coeffs => {
    const b = baselineFor(athlete)
    const yTrain0 = b[m]
    const yRest0 = getRestY0For(athlete, m)
    const b0 = Math.log(Math.max(1e-9, yTrain0) / Math.max(1e-9, yRest0))
    if (m === 'myoglobin') return { b0, b1: 0.85, b2: 0.25, b3: -0.55 }
    if (m === 'protein') return { b0, b1: 0.45, b2: 0.35, b3: -0.4 }
    if (m === 'ketones') return { b0, b1: 0.7, b2: 0.3, b3: -0.5 }
    return { b0, b1: 0.3, b2: 0.55, b3: -0.35 }
  }

  const fitCoeffs = (m: MarkerKey): Coeffs => {
    const b = baseline.value
    const yRest0 = getRestY0(m)
    const samples = Object.values(deps.activeRows.value).filter(
      (r) =>
        isFilled(r) &&
        typeof r[m] === 'number' &&
        Number.isFinite(r[m] as number) &&
        (r[m] as number) > 0
    )
    if (samples.length < 6) return defaultCoeffs(m)

    try {
      const X = samples.map((r) => {
        const dV = mkDelta(r.V as number, b.V)
        const dP = mkDelta(r.P as number, b.P)
        const dR = mkDelta(r.R as number, b.R)
        return [1, dV, dP, dR]
      })
      const y = samples.map((r) => Math.log((r[m] as number) / yRest0))
      const fit = olsFit(X, y)
      const beta = fit.beta as [number, number, number, number]
      const out: Coeffs = { b0: beta[0], b1: beta[1], b2: beta[2], b3: beta[3] }
      if (!Number.isFinite(out.b3) || Math.abs(out.b3) < 0.02)
        return defaultCoeffs(m)
      return out
    } catch {
      return defaultCoeffs(m)
    }
  }

  const fitCoeffsFor = (athlete: Athlete, m: MarkerKey): Coeffs => {
    const b = baselineFor(athlete)
    const yRest0 = getRestY0For(athlete, m)
    const samples = Object.values(athlete.rows).filter(
      (r) =>
        isFilled(r) &&
        typeof r[m] === 'number' &&
        Number.isFinite(r[m] as number) &&
        (r[m] as number) > 0
    )
    if (samples.length < 6) return defaultCoeffsFor(athlete, m)

    try {
      const X = samples.map((r) => {
        const dV = mkDelta(r.V as number, b.V)
        const dP = mkDelta(r.P as number, b.P)
        const dR = mkDelta(r.R as number, b.R)
        return [1, dV, dP, dR]
      })
      const y = samples.map((r) => Math.log((r[m] as number) / yRest0))
      const fit = olsFit(X, y)
      const beta = fit.beta as [number, number, number, number]
      const out: Coeffs = { b0: beta[0], b1: beta[1], b2: beta[2], b3: beta[3] }
      if (!Number.isFinite(out.b3) || Math.abs(out.b3) < 0.02)
        return defaultCoeffsFor(athlete, m)
      return out
    } catch {
      return defaultCoeffsFor(athlete, m)
    }
  }

  const MARKERS: MarkerKey[] = ['creatinine', 'protein', 'myoglobin', 'ketones']

  const fitCompositeFor = (athlete: Athlete): CompositeModel | null => {
    const b = baselineFor(athlete)
    const allRows = Object.values(athlete.rows).filter(isFilled)

    // Need all 3 markers positive in every sample
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
      // ln-ratios: [ln(cr/cr0), ln(prot/prot0), ln(myo/myo0)]
      const lnRatios = samples.map((r) =>
        MARKERS.map((m) => {
          const y0 = getRestY0For(athlete, m)
          return Math.log((r[m] as number) / y0)
        })
      )

      // PCA on ln-ratios -> PC1 composite
      const pca = pcaFromSamples(lnRatios)
      const z = compositeScores(lnRatios, pca)

      // Design matrix (no intercept): [dV, dP, dR]
      const X = samples.map((r) => [
        mkDelta(r.V as number, b.V),
        mkDelta(r.P as number, b.P),
        mkDelta(r.R as number, b.R),
      ])

      // Ridge regression: z = beta1*dV + beta2*dP + beta3*dR
      const lambda = loocvLambda(X, z)
      const ridge = ridgeFit(X, z, lambda)

      // Validate: beta3 (rest coefficient) must be meaningful
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

  const buildPlan = (athlete: Athlete, variantId: PlanVariantId): Plan | null => {
    const base = baselineFor(athlete)
    const total = deps.getPlanWeeksFor(athlete)
    if (total <= 0) return null
    const settings = VARIANT_DEFAULTS[variantId]
    const composite = fitCompositeFor(athlete)
    const coeffs = composite
      ? null
      : fitCoeffsFor(athlete, settings.control)

    const clampR = (x: number) => {
      const a = Math.min(settings.rMin, settings.rMax)
      const b = Math.max(settings.rMin, settings.rMax)
      return Math.min(b, Math.max(a, x))
    }

    const out: PlannedWeek[] = []
    for (let i = 0; i < total; i++) {
      const modelName = pickModel(i, total)

      let Vmul = 1.0
      let Pmul = 1.0

      if (modelName.includes('Объём')) {
        Vmul = 1.12
        Pmul = 1.08
      } else if (modelName.includes('Интенсив')) {
        Vmul = 0.95
        Pmul = 0.85
      } else if (modelName.includes('Восстанов')) {
        Vmul = 0.75
        Pmul = 1.15
      } else if (modelName.includes('Пиков')) {
        Vmul = 0.65
        Pmul = 0.8
      }

      Vmul *= settings.V
      Pmul *= settings.P

      const sessions: PlannedSession[] = []
      for (let s = 1; s <= athlete.period.sessionsPerWeek; s++) {
        const focus = modelName.includes('Восстанов')
          ? 'Техника'
          : modelName.includes('Объём')
          ? 'Объём'
          : 'Сила'
        const withinWeekPhase =
          athlete.period.sessionsPerWeek > 1
            ? (s - 1) / (athlete.period.sessionsPerWeek - 1)
            : 0
        const withinWeekWave = Math.sin(withinWeekPhase * Math.PI * 2)
        const acrossWeeksWave = Math.sin((i + 1) * 0.9)

        const V = Math.max(
          0,
          Math.round(
            base.V *
              Vmul *
              (1 + 0.06 * settings.wave * withinWeekWave + 0.03 * acrossWeeksWave)
          )
        )
        const P = Math.max(
          10,
          Math.round(
            base.P *
              Pmul *
              (1 - 0.05 * settings.wave * withinWeekWave - 0.02 * acrossWeeksWave)
          )
        )

        const dV = mkDelta(V, base.V)
        const dP = mkDelta(P, base.P)

        const phase = (i + 1) * 0.7 + withinWeekPhase * 1.4

        let dR: number
        if (composite) {
          // Ridge + PCA composite: z_target = shift + wave*sin(phase)
          const zTarget =
            settings.targetShiftLn +
            settings.targetWaveLn * Math.sin(phase)
          const { beta } = composite.ridge
          dR = (zTarget - beta[0] * dV - beta[1] * dP) / beta[2]
        } else {
          // OLS fallback
          const lnTarget =
            coeffs!.b0 +
            settings.targetShiftLn +
            settings.targetWaveLn * Math.sin(phase)
          dR = (lnTarget - coeffs!.b0 - coeffs!.b1 * dV - coeffs!.b2 * dP) / coeffs!.b3
        }
        const Rraw = applyDelta(base.R, dR)
        const Rclamped = clampR(Rraw)
        const R = Math.round(Rclamped * 10) / 10

        const warn = !Number.isFinite(Rraw) || Rclamped !== Rraw

        sessions.push({
          id: uid(),
          week: i + 1,
          session: s,
          focus,
          model: modelName,
          V,
          P,
          R,
          workout: buildWorkout(focus, V, P),
          flag: warn ? 'Внимание' : 'OK',
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
    getRestY0,
    getRestY0For,
    defaultCoeffs,
    defaultCoeffsFor,
    fitCoeffs,
    fitCoeffsFor,
    fitCompositeFor,
    buildPlan,
    pickModel,
    buildWorkout,
    model,
  }
}
