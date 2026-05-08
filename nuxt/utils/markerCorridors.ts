import type { MarkerKey, PcaWeights, CorridorCheck } from '~/utils/plannerTypes'

export type MarkerCorridor = { low: number; high: number }

export type MarkerReferenceScale = {
  values: number[]
  unit: string
  source: string
  note?: string
}

/**
 * Reference scales taken from provided strip photos:
 * - URI-2 Мак: creatinine / albumin
 * - Уриполиан-5А: protein / ketones / hemoglobin
 *   (hemoglobin scale is used as myoglobin by user request)
 */
export const MARKER_REFERENCE_SCALES: Record<MarkerKey, MarkerReferenceScale> = {
  // URI-2 Мак (Креатинин): ммоль/л
  creatinine: {
    values: [0.9, 1.8, 4.4, 8.8, 17.7, 26.5],
    unit: 'ммоль/л',
    source: 'URI-2 Мак',
  },
  // Уриполиан-5А (Белок): г/л
  protein: {
    values: [0.0, 0.1, 0.3, 1.0, 3.0, 10.0],
    unit: 'г/л',
    source: 'Уриполиан-5А',
  },
  // Уриполиан-5А (Гемоглобин) -> myoglobin by user mapping
  myoglobin: {
    values: [0.0, 10, 25, 50, 250],
    unit: 'эр/мкл',
    source: 'Уриполиан-5А',
    note: 'Гемоглобин принят как миоглобин по договоренности',
  },
  // Уриполиан-5А (Кетоны): ммоль/л
  ketones: {
    values: [0.0, 0.5, 1.5, 4.0, 8.0, 16.0],
    unit: 'ммоль/л',
    source: 'Уриполиан-5А',
  },
}

// для креатинина до 4.4 - незначительно 8.8 - средне 17.7 - 26.5;
// белок  до 1.0 незначительно 3.0-средне больше или равно 20 много
// для миоглобина до 10 незначит 10-25 средне, больше  200 много
// для кетонов до 1.5 - незнач 4 - средне ; до  8-16,0 много

const toCorridor = (scale: MarkerReferenceScale): MarkerCorridor => {
  const sorted = [...scale.values].filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return { low: 0, high: 0 }
  return { low: sorted[0], high: sorted[sorted.length - 1] }
}

export const MARKER_CORRIDORS: Record<MarkerKey, MarkerCorridor> = {
  creatinine: toCorridor(MARKER_REFERENCE_SCALES.creatinine),
  protein: toCorridor(MARKER_REFERENCE_SCALES.protein),
  myoglobin: toCorridor(MARKER_REFERENCE_SCALES.myoglobin),
  ketones: toCorridor(MARKER_REFERENCE_SCALES.ketones),
}

type MarkerValues = Record<MarkerKey, number>

type HeadroomResult = {
  value: number
  limitingMarker: MarkerKey | null
}

const MARKERS: MarkerKey[] = ['creatinine', 'protein', 'myoglobin', 'ketones']

const clampNonNegative = (x: number) => (Number.isFinite(x) ? Math.max(0, x) : 0)

const currentPc1 = (current: MarkerValues, rest: MarkerValues, pca: PcaWeights) => {
  let pc1 = 0
  MARKERS.forEach((m, idx) => {
    const y = Math.max(1e-9, current[m])
    const y0 = Math.max(1e-9, rest[m])
    const x = Math.log(y / y0)
    pc1 += pca.weights[idx] * (x - pca.means[idx])
  })
  return pc1
}

const pc1LimitForMarker = (
  marker: MarkerKey,
  side: 'up' | 'down',
  rest: MarkerValues,
  pca: PcaWeights,
  corridors: Record<MarkerKey, MarkerCorridor>
) => {
  const idx = MARKERS.indexOf(marker)
  const w = pca.weights[idx]
  const mean = pca.means[idx]
  if (!Number.isFinite(w) || Math.abs(w) < 1e-8) return null

  const y0 = Math.max(1e-9, rest[marker])
  const corridor = corridors[marker]
  const xUp = Math.log((w >= 0 ? corridor.high : corridor.low) / y0)
  const xDown = Math.log((w >= 0 ? corridor.low : corridor.high) / y0)
  const x = side === 'up' ? xUp : xDown
  return (x - mean) / w
}

const headroomBySide = (
  side: 'up' | 'down',
  current: MarkerValues,
  rest: MarkerValues,
  pca: PcaWeights,
  corridors: Record<MarkerKey, MarkerCorridor> = MARKER_CORRIDORS
): HeadroomResult => {
  const pc1Now = currentPc1(current, rest, pca)
  let minHeadroom = Number.POSITIVE_INFINITY
  let limiter: MarkerKey | null = null

  for (const marker of MARKERS) {
    const limit = pc1LimitForMarker(marker, side, rest, pca, corridors)
    if (limit === null) continue
    const raw = side === 'up' ? limit - pc1Now : pc1Now - limit
    const headroom = clampNonNegative(raw)
    if (headroom < minHeadroom) {
      minHeadroom = headroom
      limiter = marker
    }
  }

  if (!Number.isFinite(minHeadroom)) {
    return { value: 0, limitingMarker: null }
  }
  return { value: minHeadroom, limitingMarker: limiter }
}

export const headroomUpInPC1 = (
  current: MarkerValues,
  rest: MarkerValues,
  pca: PcaWeights,
  corridors: Record<MarkerKey, MarkerCorridor> = MARKER_CORRIDORS
) => headroomBySide('up', current, rest, pca, corridors).value

export const headroomDownInPC1 = (
  current: MarkerValues,
  rest: MarkerValues,
  pca: PcaWeights,
  corridors: Record<MarkerKey, MarkerCorridor> = MARKER_CORRIDORS
) => headroomBySide('down', current, rest, pca, corridors).value

export const H_up_min = (
  current: MarkerValues,
  rest: MarkerValues,
  pca: PcaWeights,
  corridors: Record<MarkerKey, MarkerCorridor> = MARKER_CORRIDORS
) => headroomBySide('up', current, rest, pca, corridors)

/** Explicit order of markers inside PCA vectors (matches fitCompositeFor). */
export const PCA_MARKER_ORDER: MarkerKey[] = MARKERS

/**
 * Given a CURRENT post-training marker state and a PC1 shift ΔPC1,
 * predict new post-training values. Along the PC1 axis we have
 * Δln(y_i) ≈ w_i · ΔPC1, so y_i_new = y_i_now * exp(w_i · ΔPC1).
 */
export const predictAllMarkers = (
  current: MarkerValues,
  pca: PcaWeights,
  pc1Shift: number
): MarkerValues => {
  const out: MarkerValues = {
    creatinine: 0,
    protein: 0,
    myoglobin: 0,
    ketones: 0,
  }
  MARKERS.forEach((m, idx) => {
    const y = Math.max(1e-9, current[m])
    out[m] = y * Math.exp(pca.weights[idx] * pc1Shift)
  })
  return out
}

/** Check whether predicted marker values stay inside their corridors. */
export const checkCorridor = (
  predicted: Partial<MarkerValues>,
  corridors: Record<MarkerKey, MarkerCorridor> = MARKER_CORRIDORS
): CorridorCheck => {
  const violations: CorridorCheck['violations'] = []
  for (const m of MARKERS) {
    const v = predicted[m]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const c = corridors[m]
    if (v < c.low || v > c.high) {
      violations.push({ marker: m, predicted: v, low: c.low, high: c.high })
    }
  }
  return { ok: violations.length === 0, violations }
}
