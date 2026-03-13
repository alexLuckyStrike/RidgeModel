import { solveLinearSystem } from '~/utils/ols'

export type RidgeResult = {
  beta: number[]
  lambda: number
  r2: number
  n: number
}

const isFiniteNum = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x)

/**
 * Ridge regression (no intercept): beta = (X'X + lambda*I)^{-1} * X'y
 * X is [n x p] design matrix WITHOUT intercept column.
 */
export function ridgeFit(
  X: number[][],
  y: number[],
  lambda: number
): RidgeResult {
  const n = y.length
  const p = X[0]?.length ?? 0
  if (n === 0 || p === 0) throw new Error('Empty data')
  if (X.length !== n) throw new Error('X/y length mismatch')
  if (!y.every(isFiniteNum) || !X.flat().every(isFiniteNum))
    throw new Error('Non-finite numbers in data')

  // X'X + lambda*I (p x p)
  const XtXlI: number[][] = Array.from({ length: p }, (_, a) =>
    Array.from({ length: p }, (_, b) => {
      let s = a === b ? lambda : 0
      for (let i = 0; i < n; i++) s += X[i][a] * X[i][b]
      return s
    })
  )

  // X'y (p)
  const Xty: number[] = Array.from({ length: p }, (_, a) => {
    let s = 0
    for (let i = 0; i < n; i++) s += X[i][a] * y[i]
    return s
  })

  const beta = solveLinearSystem(XtXlI, Xty)

  // R squared
  const meanY = y.reduce((a, b) => a + b, 0) / n
  let sse = 0
  let sst = 0
  for (let i = 0; i < n; i++) {
    let yhat = 0
    for (let j = 0; j < p; j++) yhat += X[i][j] * beta[j]
    sse += (y[i] - yhat) ** 2
    sst += (y[i] - meanY) ** 2
  }
  const r2 = sst === 0 ? 1 : 1 - sse / sst

  return { beta, lambda, r2, n }
}

/**
 * Hat matrix diagonal h_ii for ridge: H = X(X'X + lambda*I)^{-1}X'
 */
function hatDiagonal(X: number[][], lambda: number): number[] {
  const n = X.length
  const p = X[0].length

  const XtXlI: number[][] = Array.from({ length: p }, (_, a) =>
    Array.from({ length: p }, (_, b) => {
      let s = a === b ? lambda : 0
      for (let i = 0; i < n; i++) s += X[i][a] * X[i][b]
      return s
    })
  )

  // h_ii = Xi * (X'X + lambda*I)^{-1} * Xi'
  const h: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const col = solveLinearSystem(XtXlI, X[i].slice())
    let s = 0
    for (let a = 0; a < p; a++) s += X[i][a] * col[a]
    h[i] = s
  }
  return h
}

const DEFAULT_LAMBDAS = [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]

/**
 * Select optimal lambda via Leave-One-Out Cross-Validation.
 * LOOCV-MSE = (1/n) sum [(yi - yhat_i) / (1 - h_ii)]^2
 */
export function loocvLambda(
  X: number[][],
  y: number[],
  lambdas: number[] = DEFAULT_LAMBDAS
): number {
  const n = y.length
  let bestLam = lambdas[0]
  let bestMse = Infinity

  for (const lam of lambdas) {
    try {
      const { beta } = ridgeFit(X, y, lam)
      const h = hatDiagonal(X, lam)

      let mse = 0
      for (let i = 0; i < n; i++) {
        let yhat = 0
        for (let j = 0; j < X[0].length; j++) yhat += X[i][j] * beta[j]
        const resid = y[i] - yhat
        const denom = 1 - h[i]
        if (Math.abs(denom) < 1e-12) continue
        mse += (resid / denom) ** 2
      }
      mse /= n

      if (mse < bestMse) {
        bestMse = mse
        bestLam = lam
      }
    } catch {
      continue
    }
  }

  return bestLam
}
