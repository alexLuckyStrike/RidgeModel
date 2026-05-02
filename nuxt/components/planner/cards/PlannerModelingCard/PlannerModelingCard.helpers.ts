export function logRelativeToBaseLine(
  rows: Record<
    string,
    {
      V: number
      P: number
      R: number
      creatinine: number
      protein: number
      myoglobin: number
      ketones: number
    }
  >,
  baseline: {
    creatinine: number
    protein: number
    myoglobin: number
    ketones: number
  },
  eps = 0.05
) {
  return Object.entries(rows).map(([sessionId, r]) => ({
    sessionId,
    V: r.V,
    P: r.P,
    R: r.R,
    xC: Math.log((r.creatinine + eps) / (baseline.creatinine + eps)),
    xP: Math.log((r.protein + eps) / (baseline.protein + eps)),
    xM: Math.log((r.myoglobin + eps) / (baseline.myoglobin + eps)),
    xK: Math.log((r.ketones + eps) / (baseline.ketones + eps)),
  }))
}
