export type PcaResult = {
  weights: number[]
  means: number[]
  explainedRatio: number
}

/**
 * Compute column means of data[n][p].
 */
export function columnMeans(data: number[][]): number[] {
  const n = data.length
  const p = data[0]?.length ?? 0
  const means = new Array(p).fill(0)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) means[j] += data[i][j]
  }
  for (let j = 0; j < p; j++) means[j] /= n
  return means
}

/**
 * Compute sample covariance matrix (p x p).
 */
export function covMatrix(data: number[][], means: number[]): number[][] {
  const n = data.length
  const p = means.length
  const cov: number[][] = Array.from({ length: p }, () => new Array(p).fill(0))

  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      const da = data[i][a] - means[a]
      for (let b = a; b < p; b++) {
        cov[a][b] += da * (data[i][b] - means[b])
      }
    }
  }

  const denom = n > 1 ? n - 1 : 1
  for (let a = 0; a < p; a++) {
    cov[a][a] /= denom
    for (let b = a + 1; b < p; b++) {
      cov[a][b] /= denom
      cov[b][a] = cov[a][b]
    }
  }
  return cov
}

/**
 * Extract PC1 via power iteration.
 * Efficient for small matrices (3x3).
 */
export function pc1Extract(
  cov: number[][],
  maxIter = 200,
  tol = 1e-10
): { weights: number[]; eigenvalue: number } {
  const p = cov.length
  let v = new Array(p).fill(1 / Math.sqrt(p))
  let eigenvalue = 0

  for (let iter = 0; iter < maxIter; iter++) {
    const w = new Array(p).fill(0)
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) w[i] += cov[i][j] * v[j]
    }

    const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0))
    if (norm < 1e-15) break

    eigenvalue = norm
    const vNew = w.map((x) => x / norm)

    const diff = vNew.reduce((s, x, i) => s + (x - v[i]) ** 2, 0)
    v = vNew
    if (diff < tol) break
  }

  // Consistent sign: first nonzero component positive
  const first = v.findIndex((x) => Math.abs(x) > 1e-12)
  if (first >= 0 && v[first] < 0) {
    for (let i = 0; i < p; i++) v[i] = -v[i]
  }

  return { weights: v, eigenvalue }
}

/**
 * Compute composite PC1 scores.
 * z_i = sum_j w_j * (data[i][j] - means[j])
 */
export function compositeScores(data: number[][], pca: PcaResult): number[] {
  return data.map((row) => {
    let z = 0
    for (let j = 0; j < pca.weights.length; j++) {
      z += pca.weights[j] * (row[j] - pca.means[j])
    }
    return z
  })
}

/**
 * Full PCA pipeline: means -> cov -> PC1 -> result.
 * data[i] = [ln(cr_i/cr0), ln(prot_i/prot0), ln(myo_i/myo0)]
 */
export function pcaFromSamples(data: number[][]): PcaResult {
  if (data.length < 2) throw new Error('Need >= 2 samples for PCA')
  const p = data[0].length
  const means = columnMeans(data)
  const cov = covMatrix(data, means)
  const { weights, eigenvalue } = pc1Extract(cov)

  let totalVar = 0
  for (let i = 0; i < p; i++) totalVar += cov[i][i]
  const explainedRatio = totalVar > 0 ? eigenvalue / totalVar : 0

  return { weights, means, explainedRatio }
}
