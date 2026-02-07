export type OlsResult = {
  /** beta[0] is intercept */
  beta: [number, ...number[]]
  r2: number
  n: number
}

type Matrix = number[][]

const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/**
 * Ordinary Least Squares for y = X * beta + e
 * X must already include intercept column if desired.
 */
export function olsFit(X: Matrix, y: number[]): OlsResult {
  if (!Array.isArray(X) || !Array.isArray(y)) throw new Error('Invalid input')
  const n = y.length
  if (n === 0) throw new Error('Empty data')
  if (X.length !== n) throw new Error('X/y length mismatch')
  const p = X[0]?.length ?? 0
  if (p === 0) throw new Error('Empty design matrix')
  if (!X.every((row) => row.length === p)) throw new Error('Jagged design matrix')
  if (!y.every(isFiniteNumber) || !X.flat().every(isFiniteNumber)) throw new Error('Non-finite numbers in data')

  // XtX (p x p) and Xty (p)
  const XtX: Matrix = Array.from({ length: p }, () => Array.from({ length: p }, () => 0))
  const Xty: number[] = Array.from({ length: p }, () => 0)

  for (let i = 0; i < n; i++) {
    const xi = X[i]
    const yi = y[i]
    for (let a = 0; a < p; a++) {
      Xty[a] += xi[a] * yi
      for (let b = 0; b < p; b++) {
        XtX[a][b] += xi[a] * xi[b]
      }
    }
  }

  const beta = solveLinearSystem(XtX, Xty)

  // R^2
  const meanY = y.reduce((a, b) => a + b, 0) / n
  let sse = 0
  let sst = 0
  for (let i = 0; i < n; i++) {
    const yhat = dot(X[i], beta)
    const err = y[i] - yhat
    sse += err * err
    const dev = y[i] - meanY
    sst += dev * dev
  }
  const r2 = sst === 0 ? 1 : 1 - sse / sst

  return { beta: beta as [number, ...number[]], r2, n }
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/**
 * Solve A x = b using Gaussian elimination with partial pivoting.
 * Throws if matrix is singular/ill-conditioned for our use.
 */
function solveLinearSystem(Ain: Matrix, bin: number[]): number[] {
  const n = Ain.length
  const A: Matrix = Ain.map((row) => row.slice())
  const b = bin.slice()

  for (let col = 0; col < n; col++) {
    // pivot
    let pivotRow = col
    let pivotVal = Math.abs(A[col][col])
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r][col])
      if (v > pivotVal) {
        pivotVal = v
        pivotRow = r
      }
    }
    if (pivotVal < 1e-12) throw new Error('Singular matrix (pivot ~ 0)')

    if (pivotRow !== col) {
      ;[A[col], A[pivotRow]] = [A[pivotRow], A[col]]
      ;[b[col], b[pivotRow]] = [b[pivotRow], b[col]]
    }

    // normalize pivot row
    const pivot = A[col][col]
    for (let c = col; c < n; c++) A[col][c] /= pivot
    b[col] /= pivot

    // eliminate other rows
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = A[r][col]
      if (factor === 0) continue
      for (let c = col; c < n; c++) {
        A[r][c] -= factor * A[col][c]
      }
      b[r] -= factor * b[col]
    }
  }

  return b
}
