// релятивистское среднее - относительно базовой линии

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

// стандартизация
export type FlatRow = {
  athleteId: string
  sessionId: string
  V: number
  P: number
  R: number
  xC: number
  xP: number
  xM: number
  xK: number
}

export type StandardizedRow = {
  athleteId: string
  sessionId: string
  V: number
  P: number
  R: number
  zC: number
  zP: number
  zM: number
  zK: number
}

export type MarkerStats = {
  xC: number
  xP: number
  xM: number
  xK: number
}

export type StandardizedFlat = {
  means: MarkerStats
  stds: MarkerStats
  rows: StandardizedRow[]
}

export function standardizeMarkers(flatRows: FlatRow[]): StandardizedFlat {
  if (!Array.isArray(flatRows) || flatRows.length < 2) {
    throw new Error('standardizeMarkers requires at least 2 observations')
  }

  const markerKeys = ['xC', 'xP', 'xM', 'xK'] as const
  type MarkerKey = (typeof markerKeys)[number]

  // 1. Проверка данных
  flatRows.forEach((row, i) => {
    for (const k of markerKeys) {
      if (!Number.isFinite(row[k])) {
        throw new Error(
          `Row ${i} (athlete ${row.athleteId}, session ${row.sessionId}) has invalid value for "${k}"`
        )
      }
    }
  })

  const n = flatRows.length

  // 2. Средние
  const means: MarkerStats = { xC: 0, xP: 0, xM: 0, xK: 0 }
  for (const k of markerKeys) {
    let sum = 0
    for (const row of flatRows) sum += row[k]
    means[k] = sum / n
  }

  // 3. Выборочные std (деление на n-1)
  const stds: MarkerStats = { xC: 0, xP: 0, xM: 0, xK: 0 }
  for (const k of markerKeys) {
    let sumSq = 0
    for (const row of flatRows) {
      const diff = row[k] - means[k]
      sumSq += diff * diff
    }
    const std = Math.sqrt(sumSq / (n - 1))
    if (std === 0) {
      throw new Error(`Cannot standardize column "${k}" with zero variance`)
    }
    stds[k] = std
  }

  // 4. Стандартизация
  const rows: StandardizedRow[] = flatRows.map((row) => ({
    athleteId: row.athleteId,
    sessionId: row.sessionId,
    V: row.V,
    P: row.P,
    R: row.R,
    zC: (row.xC - means.xC) / stds.xC,
    zP: (row.xP - means.xP) / stds.xP,
    zM: (row.xM - means.xM) / stds.xM,
    zK: (row.xK - means.xK) / stds.xK,
  }))

  return { means, stds, rows }
}

//// 2 часть. Ковариационная матрица и PCA
export function computeCovarianceMatrix<T>(rows: T[], featureKeys: (keyof T)[]): number[][] {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('computeCovarianceMatrix requires at least 2 rows')
  }
  if (!Array.isArray(featureKeys) || featureKeys.length === 0) {
    throw new Error('featureKeys must be a non-empty array')
  }

  const n = rows.length
  const k = featureKeys.length

  // Проверка значений
  rows.forEach((row, i) => {
    for (const key of featureKeys) {
      const value = row[key]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Row ${i} has invalid value for key "${String(key)}"`)
      }
    }
  })

  // 1. Средние по каждому признаку
  const means: number[] = new Array(k).fill(0)
  for (let j = 0; j < k; j++) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += row(rows[i], featureKeys[j])
    means[j] = sum / n
  }

  // 2. Ковариационная матрица k×k
  const cov: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))

  for (let a = 0; a < k; a++) {
    for (let b = a; b < k; b++) {
      // только верхний треугольник, потом отзеркалим
      let sum = 0
      for (let i = 0; i < n; i++) {
        const xa = row(rows[i], featureKeys[a]) - means[a]
        const xb = row(rows[i], featureKeys[b]) - means[b]
        sum += xa * xb
      }
      const c = sum / (n - 1)
      cov[a][b] = c
      cov[b][a] = c // симметрия
    }
  }

  return cov
}

function row<T>(obj: T, key: keyof T): number {
  return obj[key] as unknown as number
}

/// Метод Якоби-Гаусса для нахождения собственных векторов и значений ковариационной матрицы
export type EigenPair = {
  value: number // собственное значение λ
  vector: number[] // собственный вектор v (длины N)
}

/**
 * Метод Якоби для симметричной матрицы.
 * Возвращает массив пар (λ, v), отсортированный по убыванию λ.
 */
export function jacobiEigenDecomposition(
  matrix: number[][],
  options: { tolerance?: number; maxIterations?: number } = {}
): EigenPair[] {
  const tol = options.tolerance ?? 1e-12
  const maxIter = options.maxIterations ?? 100

  const n = matrix.length

  if (n === 0) {
    throw new Error('Matrix must not be empty')
  }
  for (let i = 0; i < n; i++) {
    if (matrix[i].length !== n) {
      throw new Error('Matrix must be square')
    }
    for (let j = 0; j < n; j++) {
      if (!Number.isFinite(matrix[i][j])) {
        throw new Error(`Invalid value at [${i}][${j}]`)
      }
      if (Math.abs(matrix[i][j] - matrix[j][i]) > 1e-10) {
        throw new Error('Matrix must be symmetric')
      }
    }
  }

  // Копия матрицы, которую мы будем диагонализовать
  const a: number[][] = matrix.map((row) => row.slice())

  // Матрица собственных векторов (начинаем с единичной)
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  )

  for (let iter = 0; iter < maxIter; iter++) {
    // 1. Найти самый большой внедиагональный элемент по модулю
    let p = 0
    let q = 1
    let maxOff = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[i][j]) > maxOff) {
          maxOff = Math.abs(a[i][j])
          p = i
          q = j
        }
      }
    }

    // 2. Если все внедиагональные близки к нулю — закончили
    if (maxOff < tol) break

    // 3. Вычислить угол поворота через t = tan(θ)
    const apq = a[p][q]
    const app = a[p][p]
    const aqq = a[q][q]
    const theta = (aqq - app) / (2 * apq)
    const t =
      theta >= 0
        ? 1 / (theta + Math.sqrt(1 + theta * theta))
        : 1 / (theta - Math.sqrt(1 + theta * theta))
    const c = 1 / Math.sqrt(1 + t * t)
    const s = t * c

    // 4. Применить вращение к матрице a
    a[p][p] = app - t * apq
    a[q][q] = aqq + t * apq
    a[p][q] = 0
    a[q][p] = 0

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = a[i][p]
        const aiq = a[i][q]
        a[i][p] = c * aip - s * aiq
        a[p][i] = a[i][p]
        a[i][q] = s * aip + c * aiq
        a[q][i] = a[i][q]
      }
    }

    // 5. Параллельно обновить v (накопление поворотов)
    for (let i = 0; i < n; i++) {
      const vip = v[i][p]
      const viq = v[i][q]
      v[i][p] = c * vip - s * viq
      v[i][q] = s * vip + c * viq
    }
  }

  // Собрать результат: пары (λ, столбец v)
  const pairs: EigenPair[] = []
  for (let j = 0; j < n; j++) {
    const vector: number[] = new Array(n)
    for (let i = 0; i < n; i++) vector[i] = v[i][j]
    pairs.push({ value: a[j][j], vector })
  }

  // Сортировка по убыванию собственного значения
  pairs.sort((x, y) => y.value - x.value)

  return pairs
}

// Проекция на PC1
export type FlatRowWithPC1 = {
  athleteId: string
  sessionId: string
  V: number
  P: number
  R: number
  PC1: number
}

/**
 * Проецирует стандартизированные маркеры на первую главную компоненту.
 * PC₁ᵢ = a₁·zC + a₂·zP + a₃·zM + a₄·zK
 *
 * @param standardizedRows  массив строк с z-значениями (576 строк)
 * @param pc1Vector         собственный вектор PC₁ длины 4: [aC, aP, aM, aK]
 */
export function projectOnPC1(
  standardizedRows: StandardizedRow[],
  pc1Vector: number[]
): FlatRowWithPC1[] {
  if (pc1Vector.length !== 4) {
    throw new Error(`pc1Vector must have 4 components, got ${pc1Vector.length}`)
  }
  for (const v of pc1Vector) {
    if (!Number.isFinite(v)) {
      throw new Error('pc1Vector contains invalid values')
    }
  }

  const [aC, aP, aM, aK] = pc1Vector

  return standardizedRows.map((row) => ({
    athleteId: row.athleteId,
    sessionId: row.sessionId,
    V: row.V,
    P: row.P,
    R: row.R,
    PC1: aC * row.zC + aP * row.zP + aM * row.zM + aK * row.zK,
  }))
}

export function stabilizeSign(vector: number[]): number[] {
  const sumSign = vector.reduce((s, v) => s + v, 0)
  return sumSign < 0 ? vector.map((v) => -v) : vector
}

// функция нормализации нагрузок
// import type { FlatRowWithPC1 } from './projectOnPC1'

export type FlatRowWithLoads = {
  athleteId: string
  sessionId: string
  PC1: number
  dV: number
  dP: number
  dR: number
}

/**
 * Нормализует параметры тренировочной нагрузки относительно
 * индивидуальной средней спортсмена за весь период наблюдения.
 *
 * Для каждого спортсмена рассчитываются V̄, P̄, R̄ — средние по всем его сессиям.
 * Затем для каждой строки:
 *   dV = (V − V̄) / V̄
 *   dP = (P − P̄) / P̄
 *   dR = (R − R̄) / R̄
 *
 * @throws если какое-то V̄, P̄, R̄ окажется равно нулю — деление невозможно
 */
export function normalizeLoads(rows: FlatRowWithPC1[]): FlatRowWithLoads[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('normalizeLoads requires non-empty array')
  }

  // 1. Группируем строки по athleteId
  const byAthlete = new Map<string, FlatRowWithPC1[]>()
  for (const row of rows) {
    if (!Number.isFinite(row.V) || !Number.isFinite(row.P) || !Number.isFinite(row.R)) {
      throw new Error(`Invalid V/P/R for athlete ${row.athleteId}, session ${row.sessionId}`)
    }
    const list = byAthlete.get(row.athleteId) ?? []
    list.push(row)
    byAthlete.set(row.athleteId, list)
  }

  // 2. Для каждого спортсмена считаем средние и нормализуем
  const result: FlatRowWithLoads[] = []

  for (const [athleteId, athleteRows] of byAthlete) {
    const n = athleteRows.length
    if (n < 2) {
      throw new Error(`Athlete ${athleteId} has only ${n} session(s), need at least 2`)
    }

    // Средние V̄, P̄, R̄ по всем сессиям этого спортсмена
    let sumV = 0,
      sumP = 0,
      sumR = 0
    for (const r of athleteRows) {
      sumV += r.V
      sumP += r.P
      sumR += r.R
    }
    const meanV = sumV / n
    const meanP = sumP / n
    const meanR = sumR / n

    // Защита от деления на ноль
    if (meanV === 0 || meanP === 0 || meanR === 0) {
      throw new Error(`Cannot normalize loads for athlete ${athleteId}: zero mean detected`)
    }

    // Относительные отклонения от индивидуальной нормы
    for (const r of athleteRows) {
      result.push({
        athleteId: r.athleteId,
        sessionId: r.sessionId,
        PC1: r.PC1,
        dV: (r.V - meanV) / meanV,
        dP: (r.P - meanP) / meanP,
        dR: (r.R - meanR) / meanR,
      })
    }
  }

  return result
}

// Функция стандартизации

export type Standardization = {
  means: Record<string, number>
  stds: Record<string, number>
}

export type StandardizedResult<T, K extends keyof T> = {
  rows: Array<T & { [P in K as `z_${string & P}`]: number }>
  standardization: Standardization
}

/**
 * Z-стандартизация выбранных числовых колонок.
 * Для каждой колонки key из featureKeys:
 *   1. Считает среднее μ и выборочное std σ по всем строкам
 *   2. Добавляет в каждую строку поле `z_${key}` = (row[key] − μ) / σ
 *
 * Возвращает обогащённые строки + объект со средними и std
 * (нужен для интерпретации результата и для применения той же
 * стандартизации к новым данным).
 *
 * @throws если строк меньше 2 или std какой-то колонки = 0
 */
export function standardizeColumns<T extends Record<string, unknown>, K extends keyof T & string>(
  rows: T[],
  featureKeys: K[]
): StandardizedResult<T, K> {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('standardizeColumns requires at least 2 rows')
  }
  if (!Array.isArray(featureKeys) || featureKeys.length === 0) {
    throw new Error('featureKeys must be non-empty')
  }

  // Валидация
  rows.forEach((row, i) => {
    for (const key of featureKeys) {
      const v = row[key]
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(`Row ${i} has invalid value for "${key}"`)
      }
    }
  })

  const n = rows.length
  const means: Record<string, number> = {}
  const stds: Record<string, number> = {}

  // 1. Средние
  for (const key of featureKeys) {
    let sum = 0
    for (const row of rows) sum += row[key] as number
    means[key] = sum / n
  }

  // 2. Выборочные std (деление на n−1)
  for (const key of featureKeys) {
    let sumSq = 0
    for (const row of rows) {
      const diff = (row[key] as number) - means[key]
      sumSq += diff * diff
    }
    const std = Math.sqrt(sumSq / (n - 1))
    if (std === 0) {
      throw new Error(`Column "${key}" has zero variance`)
    }
    stds[key] = std
  }

  // 3. Стандартизация — обогащаем каждую строку z-значениями
  const enriched = rows.map((row) => {
    const extras: Record<string, number> = {}
    for (const key of featureKeys) {
      extras[`z_${key}`] = ((row[key] as number) - means[key]) / stds[key]
    }
    return { ...row, ...extras }
  })

  return {
    rows: enriched as StandardizedResult<T, K>['rows'],
    standardization: { means, stds },
  }
}

/// 4 блок
/**
 * Транспонирует матрицу: строки становятся столбцами.
 * Если на входе матрица m×n, на выходе будет n×m.
 *
 * Элемент result[i][j] равен matrix[j][i].
 */
export function transposeMatrix(matrix: number[][]): number[][] {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error('Matrix must be non-empty')
  }

  const rows = matrix.length
  const cols = matrix[0].length

  // Все строки должны иметь одинаковую длину
  for (let i = 0; i < rows; i++) {
    if (matrix[i].length !== cols) {
      throw new Error(`Row ${i} has length ${matrix[i].length}, expected ${cols}`)
    }
  }

  // Создаём результат размера cols × rows
  const result: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0))

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = matrix[i][j]
    }
  }

  return result
}

// Умножение матриц
/**
 * Умножение двух матриц: A · B
 * Размерности должны быть согласованы: число столбцов A = число строк B.
 *
 * Если A имеет размер m×n, а B имеет размер n×k,
 * результат — матрица размера m×k.
 *
 * Элемент result[i][j] = Σ A[i][p] · B[p][j] по p от 0 до n-1
 */
export function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  if (!Array.isArray(A) || A.length === 0) {
    throw new Error('Matrix A must be non-empty')
  }
  if (!Array.isArray(B) || B.length === 0) {
    throw new Error('Matrix B must be non-empty')
  }

  const m = A.length // число строк A
  const n = A[0].length // число столбцов A
  const nB = B.length // число строк B
  const k = B[0].length // число столбцов B

  if (n !== nB) {
    throw new Error(`Cannot multiply: A has ${n} columns but B has ${nB} rows`)
  }

  // Все строки A должны быть одинаковой длины
  for (let i = 0; i < m; i++) {
    if (A[i].length !== n) {
      throw new Error(`Row ${i} of A has wrong length`)
    }
  }
  // Все строки B должны быть одинаковой длины
  for (let i = 0; i < nB; i++) {
    if (B[i].length !== k) {
      throw new Error(`Row ${i} of B has wrong length`)
    }
  }

  // Создаём результат m × k, заполненный нулями
  const result: number[][] = Array.from({ length: m }, () => new Array(k).fill(0))

  // Тройной цикл: i — строка результата, j — столбец, p — общая ось
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < k; j++) {
      let sum = 0
      for (let p = 0; p < n; p++) {
        sum += A[i][p] * B[p][j]
      }
      result[i][j] = sum
    }
  }

  return result
}

// Решение уравнений методом Гаусса
/**
 * Решает систему линейных уравнений A·x = b методом Гаусса
 * с частичным выбором главного элемента.
 *
 * @param A квадратная матрица n×n
 * @param b вектор длины n
 * @returns вектор x длины n такой, что A·x = b
 *
 * @throws если матрица не квадратная или вырожденная (система не имеет
 *         единственного решения)
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length

  if (n === 0) {
    throw new Error('Matrix A must be non-empty')
  }
  if (b.length !== n) {
    throw new Error(`Vector b has length ${b.length}, expected ${n}`)
  }
  for (let i = 0; i < n; i++) {
    if (A[i].length !== n) {
      throw new Error('Matrix A must be square')
    }
  }

  // Создаём расширенную матрицу [A | b], копируя данные
  // (не мутируем исходные A и b)
  const M: number[][] = A.map((row, i) => [...row, b[i]])

  // ============ ПРЯМОЙ ХОД ============
  for (let col = 0; col < n; col++) {
    // 1. Выбор главного элемента: ищем строку с максимальным
    //    по модулю значением в текущем столбце среди строк ≥ col
    let pivotRow = col
    let maxAbs = Math.abs(M[col][col])
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(M[row][col])
      if (v > maxAbs) {
        maxAbs = v
        pivotRow = row
      }
    }

    // 2. Если все элементы в столбце ≈ 0, матрица вырожденная
    if (maxAbs < 1e-12) {
      throw new Error('Matrix is singular or nearly singular')
    }

    // 3. Меняем местами строки col и pivotRow
    if (pivotRow !== col) {
      ;[M[col], M[pivotRow]] = [M[pivotRow], M[col]]
    }

    // 4. Обнуляем все элементы под диагональю в этом столбце
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col]
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k]
      }
    }
  }

  // ============ ОБРАТНЫЙ ХОД ============
  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = M[row][n] // правая часть c'
    for (let col = row + 1; col < n; col++) {
      sum -= M[row][col] * x[col]
    }
    x[row] = sum / M[row][row]
  }

  return x
}

export type RidgeResult = {
  beta: number[] // коэффициенты [β_V, β_P, β_R]
  featureNames: string[] // ['z_dV', 'z_dP', 'z_dR']
  lambda: number // использованное λ
}

/**
 * Многомерная ridge-регрессия без интерсепта.
 *
 * Решает задачу:  y = X·β + ε,  с регуляризацией ||β||² → min
 *
 * Формула:  β = (XᵀX + λI)⁻¹ Xᵀy
 *
 * @param X         матрица предикторов размера n × p
 * @param y         вектор откликов длины n
 * @param lambda    параметр регуляризации (≥ 0)
 * @param featureNames имена признаков (для удобства интерпретации)
 */
export function ridgeRegression(
  X: number[][],
  y: number[],
  lambda: number,
  featureNames: string[]
): RidgeResult {
  // 1. Валидация
  if (!Array.isArray(X) || X.length === 0) {
    throw new Error('Matrix X must be non-empty')
  }
  if (X.length !== y.length) {
    throw new Error(`X has ${X.length} rows but y has ${y.length} elements`)
  }
  if (lambda < 0) {
    throw new Error('lambda must be non-negative')
  }
  const p = X[0].length
  if (featureNames.length !== p) {
    throw new Error(
      `featureNames length ${featureNames.length} does not match number of features ${p}`
    )
  }

  // 2. Транспонируем X — получаем Xᵀ размера p × n
  const Xt = transposeMatrix(X)

  // 3. Считаем XᵀX размера p × p
  const XtX = multiplyMatrices(Xt, X)

  // 4. Прибавляем λ к диагонали: A = XᵀX + λI
  const A: number[][] = XtX.map((row, i) =>
    row.map((value, j) => (i === j ? value + lambda : value))
  )

  // 5. Считаем Xᵀy
  // y превращаем в столбец, чтобы перемножить как матрицы
  const yColumn = y.map((v) => [v])
  const XtyMat = multiplyMatrices(Xt, yColumn)
  const Xty = XtyMat.map((row) => row[0]) // обратно в вектор

  // 6. Решаем систему A·β = Xᵀy
  const beta = solveLinearSystem(A, Xty)

  return {
    beta,
    featureNames,
    lambda,
  }
}

//// 5 блок - проверка качества
//import { multiplyMatrices } from './multiplyMatrices'

export type ModelMetrics = {
  predictions: number[] // ŷ для каждого наблюдения
  residuals: number[] // ошибки (yᵢ − ŷᵢ)
  r2: number // коэффициент детерминации
  rmse: number // среднеквадратичная ошибка
  n: number // число наблюдений
}

/**
 * Рассчитывает предсказания и метрики качества для линейной модели.
 *
 * Модель: ŷ = X · β  (без интерсепта)
 *
 * Метрики:
 *   R² = 1 − SSres / SStot
 *   RMSE = sqrt(SSres / n)
 *
 * где:
 *   SSres = Σ (yᵢ − ŷᵢ)²    — сумма квадратов остатков
 *   SStot = Σ (yᵢ − ȳ)²     — общая сумма квадратов
 *   ȳ — среднее по y
 *
 * @param X      матрица предикторов n × p
 * @param y      вектор реальных значений длины n
 * @param beta   коэффициенты модели длины p
 */
export function evaluateModel(X: number[][], y: number[], beta: number[]): ModelMetrics {
  if (X.length !== y.length) {
    throw new Error(`X has ${X.length} rows, y has ${y.length}`)
  }
  if (X.length === 0) {
    throw new Error('X must be non-empty')
  }
  if (X[0].length !== beta.length) {
    throw new Error(`X has ${X[0].length} columns, but beta has ${beta.length} elements`)
  }

  const n = X.length

  // Предсказания: ŷ = X · β
  // Превращаем beta в столбец, умножаем матрицы, "разворачиваем" обратно в вектор
  const betaCol = beta.map((v) => [v])
  const predMat = multiplyMatrices(X, betaCol)
  const predictions = predMat.map((row) => row[0])

  // Остатки: residual_i = y_i − ŷ_i
  const residuals = y.map((yi, i) => yi - predictions[i])

  // Среднее y (для SStot)
  const yMean = y.reduce((s, v) => s + v, 0) / n

  // SSres — сумма квадратов остатков
  let ssRes = 0
  for (const r of residuals) ssRes += r * r

  // SStot — сумма квадратов отклонений y от среднего
  let ssTot = 0
  for (const yi of y) {
    const d = yi - yMean
    ssTot += d * d
  }

  // R² и RMSE
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  const rmse = Math.sqrt(ssRes / n)

  return { predictions, residuals, r2, rmse, n }
}

// Кросс-валидация

export type CVFoldResult = {
  foldIndex: number
  testAthleteIds: string[]
  trainSize: number
  testSize: number
  beta: number[]
  trainR2: number
  testR2: number
  testRMSE: number
}

export type CVResult = {
  lambda: number
  k: number
  folds: CVFoldResult[]
  meanCVR2: number // среднее CV-R² (главная метрика)
  stdCVR2: number // SD между фолдами (стабильность)
  meanCVRMSE: number // средняя CV-RMSE
  meanTrainR2: number // среднее training R² для сравнения
}

type DataRow = {
  athleteId: string
  PC1: number
  z_dV: number
  z_dP: number
  z_dR: number
}

/**
 * Group K-Fold кросс-валидация для ridge-регрессии.
 * Разбивает СПОРТСМЕНОВ на k групп. В каждой итерации обучает модель
 * на k-1 группах и тестирует на оставшейся, считая out-of-sample R².
 *
 * Это даёт честную оценку качества модели на "новых" спортсменах.
 */
export function groupKFoldCV(data: DataRow[], lambda: number, k: number): CVResult {
  if (k < 2) throw new Error('k must be at least 2')
  if (data.length === 0) throw new Error('data must be non-empty')

  // 1. Получаем уникальный список спортсменов
  const athleteIds = Array.from(new Set(data.map((r) => r.athleteId)))
  if (athleteIds.length < k) {
    throw new Error(`Not enough athletes (${athleteIds.length}) for k = ${k}`)
  }

  // 2. Распределяем спортсменов по k фолдам "равномерно"
  //    Сортируем для воспроизводимости (без рандома)
  athleteIds.sort()
  const folds: string[][] = Array.from({ length: k }, () => [])
  athleteIds.forEach((id, i) => {
    folds[i % k].push(id)
  })

  // 3. Прогоняем k итераций
  const foldResults: CVFoldResult[] = []

  for (let foldIdx = 0; foldIdx < k; foldIdx++) {
    const testAthletes = new Set(folds[foldIdx])

    // Разделение: train = все строки, чьи спортсмены НЕ в testAthletes
    //             test  = все строки, чьи спортсмены В testAthletes
    const trainRows = data.filter((r) => !testAthletes.has(r.athleteId))
    const testRows = data.filter((r) => testAthletes.has(r.athleteId))

    // Извлекаем матрицу X и вектор y для train
    const Xtrain = trainRows.map((r) => [r.z_dV, r.z_dP, r.z_dR])
    const ytrain = trainRows.map((r) => r.PC1)

    // Обучаем модель на train
    const ridge = ridgeRegression(Xtrain, ytrain, lambda, ['z_dV', 'z_dP', 'z_dR'])

    // Метрики на train (для сравнения с test)
    const trainMetrics = evaluateModel(Xtrain, ytrain, ridge.beta)

    // Метрики на test (out-of-sample)
    const Xtest = testRows.map((r) => [r.z_dV, r.z_dP, r.z_dR])
    const ytest = testRows.map((r) => r.PC1)
    const testMetrics = evaluateModel(Xtest, ytest, ridge.beta)

    foldResults.push({
      foldIndex: foldIdx + 1,
      testAthleteIds: folds[foldIdx],
      trainSize: trainRows.length,
      testSize: testRows.length,
      beta: ridge.beta,
      trainR2: trainMetrics.r2,
      testR2: testMetrics.r2,
      testRMSE: testMetrics.rmse,
    })
  }

  // 4. Агрегируем результаты по всем фолдам
  const cvR2s = foldResults.map((f) => f.testR2)
  const meanCVR2 = cvR2s.reduce((s, v) => s + v, 0) / k
  const stdCVR2 = Math.sqrt(cvR2s.reduce((s, v) => s + (v - meanCVR2) ** 2, 0) / (k - 1))

  const cvRMSEs = foldResults.map((f) => f.testRMSE)
  const meanCVRMSE = cvRMSEs.reduce((s, v) => s + v, 0) / k

  const trainR2s = foldResults.map((f) => f.trainR2)
  const meanTrainR2 = trainR2s.reduce((s, v) => s + v, 0) / k

  return {
    lambda,
    k,
    folds: foldResults,
    meanCVR2,
    stdCVR2,
    meanCVRMSE,
    meanTrainR2,
  }
}

// Выбираем лучший лямбда кросс-валидация

export type LambdaSelectionResult = {
  bestLambda: number
  bestCVR2: number
  bestCVRMSE: number
  results: CVResult[] // все результаты для всех λ — пригодится для графика
}

/**
 * Подбор оптимального параметра регуляризации λ
 * через групповую k-fold кросс-валидацию.
 *
 * Прогоняет CV для каждого значения λ из списка кандидатов
 * и выбирает λ с максимальным CV-R².
 *
 * Логарифмическая сетка кандидатов даёт хорошее покрытие
 * нескольких порядков величины.
 *
 * @param data       плоская таблица 576 наблюдений
 * @param lambdas    список кандидатов λ (в порядке возрастания)
 * @param k          число фолдов в кросс-валидации
 */
export function selectBestLambda(
  data: DataRow[],
  lambdas: number[],
  k: number
): LambdaSelectionResult {
  if (!Array.isArray(lambdas) || lambdas.length === 0) {
    throw new Error('lambdas must be a non-empty array')
  }
  for (const lam of lambdas) {
    if (lam < 0 || !Number.isFinite(lam)) {
      throw new Error(`Invalid lambda value: ${lam}`)
    }
  }

  const results: CVResult[] = []

  for (const lambda of lambdas) {
    const cv = groupKFoldCV(data, lambda, k)
    results.push(cv)
  }

  // Находим λ с максимальным CV-R²
  let bestIndex = 0
  for (let i = 1; i < results.length; i++) {
    if (results[i].meanCVR2 > results[bestIndex].meanCVR2) {
      bestIndex = i
    }
  }

  return {
    bestLambda: results[bestIndex].lambda,
    bestCVR2: results[bestIndex].meanCVR2,
    bestCVRMSE: results[bestIndex].meanCVRMSE,
    results,
  }
}
// коэффициенты ridge из стандартизованного масштаба
export type DescaledCoefficients = {
  betaInOriginalScale: Record<string, number>
  betaInZScale: Record<string, number>
  stdsUsed: Record<string, number>
}

/**
 * Преобразует коэффициенты ridge из стандартизованного масштаба
 * в исходный масштаб.
 *
 * Формула:  β_original = β_z / σ
 *
 * При условии, что μ ≈ 0 (что выполняется автоматически после
 * индивидуальной нормализации dV, dP, dR).
 *
 * @param betaZ          коэффициенты в z-масштабе [β_zV, β_zP, β_zR]
 * @param featureNames   имена признаков ['dV', 'dP', 'dR']
 * @param stds           объект {dV: σ_dV, dP: σ_dP, dR: σ_dR}
 */
export function descaleCoefficients(
  betaZ: number[],
  featureNames: string[],
  stds: Record<string, number>
): DescaledCoefficients {
  if (betaZ.length !== featureNames.length) {
    throw new Error(
      `betaZ length ${betaZ.length} doesn't match featureNames length ${featureNames.length}`
    )
  }

  const betaInOriginalScale: Record<string, number> = {}
  const betaInZScale: Record<string, number> = {}
  const stdsUsed: Record<string, number> = {}

  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i]
    const std = stds[name]

    if (std === undefined || std === null) {
      throw new Error(`No std value for feature "${name}"`)
    }
    if (std === 0) {
      throw new Error(`Cannot descale "${name}": std is zero`)
    }

    betaInZScale[name] = betaZ[i]
    stdsUsed[name] = std
    betaInOriginalScale[name] = betaZ[i] / std
  }

  return { betaInOriginalScale, betaInZScale, stdsUsed }
}

// функция Расчета порогов

export type MarkerThresholds = {
  yellow: number // граница "повышенного внимания" в исходных единицах
  red: number // граница "риска" в исходных единицах
}

export type ZoneThresholdsInput = {
  /** Клинические пороги по маркерам в исходных единицах */
  clinicalThresholds: {
    creatinine: MarkerThresholds
    protein: MarkerThresholds
    myoglobin: MarkerThresholds
    ketones: MarkerThresholds
  }
  /** Все спортсмены с baseline (для расчёта типичного baseline) */
  athletes: Athlete[]
  /** μ маркеров в логарифмической шкале (из standardizeMarkers.means) */
  markerMeans: { xC: number; xP: number; xM: number; xK: number }
  /** σ маркеров в логарифмической шкале (из standardizeMarkers.stds) */
  markerStds: { xC: number; xP: number; xM: number; xK: number }
  /** Собственный вектор PC₁: [a_C, a_P, a_M, a_K] */
  pc1Vector: number[]
  /** ε для логарифма (то же, что в logRelativeToBaseLine) */
  eps?: number
}

export type ZoneThresholdsResult = {
  /** Типичные baseline по выборке (медианы) */
  typicalBaseline: { creatinine: number; protein: number; myoglobin: number; ketones: number }
  /** PC₁ при достижении жёлтого порога каждым маркером */
  pc1AtYellow: { creatinine: number; protein: number; myoglobin: number; ketones: number }
  /** PC₁ при достижении красного порога каждым маркером */
  pc1AtRed: { creatinine: number; protein: number; myoglobin: number; ketones: number }
  /** Финальные пороги PC₁ — минимумы по маркерам */
  yellowThreshold: number
  redThreshold: number
  /** Какой маркер "сработал" первым в каждой зоне (имя маркера) */
  drivingMarkerYellow: string
  drivingMarkerRed: string
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  return n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
}

export function calculatePC1Thresholds(input: ZoneThresholdsInput): ZoneThresholdsResult {
  const eps = input.eps ?? 0.05

  // 1. Считаем типичные baseline по выборке (медианы)
  const baselines = input.athletes.map((a) => a.restBaseline)
  const typicalBaseline = {
    creatinine: median(baselines.map((b) => b.creatinine)),
    protein: median(baselines.map((b) => b.protein)),
    myoglobin: median(baselines.map((b) => b.myoglobin)),
    ketones: median(baselines.map((b) => b.ketones)),
  }

  // 2. Универсальная функция: для одного маркера → значение PC₁ при достижении порога
  const calcPC1For = (Y: number, Y0: number, mean: number, std: number, a: number): number => {
    const x = Math.log((Y + eps) / (Y0 + eps))
    const z = (x - mean) / std
    return a * z
  }

  // Связки маркер → его параметры
  const markers = [
    {
      key: 'creatinine',
      mean: input.markerMeans.xC,
      std: input.markerStds.xC,
      a: input.pc1Vector[0],
      baseline: typicalBaseline.creatinine,
    },
    {
      key: 'protein',
      mean: input.markerMeans.xP,
      std: input.markerStds.xP,
      a: input.pc1Vector[1],
      baseline: typicalBaseline.protein,
    },
    {
      key: 'myoglobin',
      mean: input.markerMeans.xM,
      std: input.markerStds.xM,
      a: input.pc1Vector[2],
      baseline: typicalBaseline.myoglobin,
    },
    {
      key: 'ketones',
      mean: input.markerMeans.xK,
      std: input.markerStds.xK,
      a: input.pc1Vector[3],
      baseline: typicalBaseline.ketones,
    },
  ] as const

  // 3. Считаем PC₁ для каждого маркера в каждой зоне
  const pc1AtYellow: Record<string, number> = {}
  const pc1AtRed: Record<string, number> = {}

  for (const m of markers) {
    const thresholds = input.clinicalThresholds[m.key as keyof typeof input.clinicalThresholds]
    pc1AtYellow[m.key] = calcPC1For(thresholds.yellow, m.baseline, m.mean, m.std, m.a)
    pc1AtRed[m.key] = calcPC1For(thresholds.red, m.baseline, m.mean, m.std, m.a)
  }

  // 4. Финальные пороги — минимумы по маркерам
  // (превышение по ЛЮБОМУ маркеру уже сигнал)
  const yellowEntries = Object.entries(pc1AtYellow)
  const redEntries = Object.entries(pc1AtRed)

  const yellowMin = yellowEntries.reduce((a, b) => (a[1] < b[1] ? a : b))
  const redMin = redEntries.reduce((a, b) => (a[1] < b[1] ? a : b))

  return {
    typicalBaseline,
    pc1AtYellow: pc1AtYellow as ZoneThresholdsResult['pc1AtYellow'],
    pc1AtRed: pc1AtRed as ZoneThresholdsResult['pc1AtRed'],
    yellowThreshold: yellowMin[1],
    redThreshold: redMin[1],
    drivingMarkerYellow: yellowMin[0],
    drivingMarkerRed: redMin[0],
  }
}

/// Посчитаем количество зон

export type MarkerThreeLevels = {
  attention: number // граница "внимания" — норма / умеренный отклик
  exceeding: number // граница "превышения" — умеренный / выраженный
  danger: number // граница "опасности" — выраженный / критический
}

export type ZoneSystemInput = {
  /** Клинические пороги по маркерам в исходных единицах (3 уровня каждый) */
  clinicalThresholds: {
    creatinine: MarkerThreeLevels
    protein: MarkerThreeLevels
    myoglobin: MarkerThreeLevels
    ketones: MarkerThreeLevels
  }
  /** Все спортсмены с baseline (для расчёта типичного baseline) */
  athletes: Athlete[]
  /** μ маркеров в логарифмической шкале (из standardizeMarkers.means) */
  markerMeans: { xC: number; xP: number; xM: number; xK: number }
  /** σ маркеров в логарифмической шкале (из standardizeMarkers.stds) */
  markerStds: { xC: number; xP: number; xM: number; xK: number }
  /** Собственный вектор PC₁: [a_C, a_P, a_M, a_K] */
  pc1Vector: number[]
  /** ε для логарифма (то же, что в logRelativeToBaseLine) */
  eps?: number
}

export type ZoneSystemResult = {
  /** Типичные baseline по выборке (медианы) */
  typicalBaseline: {
    creatinine: number
    protein: number
    myoglobin: number
    ketones: number
  }

  /** PC₁ при каждом уровне для каждого маркера (полная картина) */
  pc1ByMarkerByLevel: {
    creatinine: { attention: number; exceeding: number; danger: number }
    protein: { attention: number; exceeding: number; danger: number }
    myoglobin: { attention: number; exceeding: number; danger: number }
    ketones: { attention: number; exceeding: number; danger: number }
  }

  /** Финальные пороги PC₁ — минимумы по маркерам для каждого уровня */
  thresholds: {
    attention: number // граница: норма → умеренный отклик
    exceeding: number // граница: умеренный → выраженный отклик
    danger: number // граница: выраженный → критический отклик
  }

  /** Какой маркер "определяет" каждую границу (сработал первым) */
  drivingMarkers: {
    attention: string
    exceeding: string
    danger: string
  }
}

// function median(values: number[]): number {
//   const sorted = [...values].sort((a, b) => a - b)
//   const n = sorted.length
//   return n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
// }

/**
 * Рассчитывает четырёхзонную систему по PC₁ через проекцию
 * клинических границ маркеров на ось PC₁.
 *
 * Алгоритм для каждого маркера и каждого уровня (attention/exceeding/danger):
 *   1. Логарифмирование к типичному baseline (медиане по выборке)
 *   2. Стандартизация через μ, σ из обучения модели
 *   3. Проекция на ось PC₁ — умножение на компоненту собственного вектора
 *
 * Финальный порог для каждого уровня — минимум по четырём маркерам.
 * Это обеспечивает срабатывание при превышении любого из маркеров.
 */
export function calculateFourZoneSystem(input: ZoneSystemInput): ZoneSystemResult {
  const eps = input.eps ?? 0.05

  // 1. Типичные baseline по выборке (медианы)
  const baselines = input.athletes.map((a) => a.restBaseline)
  const typicalBaseline = {
    creatinine: median(baselines.map((b) => b.creatinine)),
    protein: median(baselines.map((b) => b.protein)),
    myoglobin: median(baselines.map((b) => b.myoglobin)),
    ketones: median(baselines.map((b) => b.ketones)),
  }

  // 2. Универсальная функция: для одного маркера → значение PC₁
  const calcPC1For = (Y: number, Y0: number, mean: number, std: number, a: number): number => {
    const x = Math.log((Y + eps) / (Y0 + eps))
    const z = (x - mean) / std
    return a * z
  }

  // Связки маркер → его параметры
  const markers = [
    {
      key: 'creatinine' as const,
      mean: input.markerMeans.xC,
      std: input.markerStds.xC,
      a: input.pc1Vector[0],
      baseline: typicalBaseline.creatinine,
    },
    {
      key: 'protein' as const,
      mean: input.markerMeans.xP,
      std: input.markerStds.xP,
      a: input.pc1Vector[1],
      baseline: typicalBaseline.protein,
    },
    {
      key: 'myoglobin' as const,
      mean: input.markerMeans.xM,
      std: input.markerStds.xM,
      a: input.pc1Vector[2],
      baseline: typicalBaseline.myoglobin,
    },
    {
      key: 'ketones' as const,
      mean: input.markerMeans.xK,
      std: input.markerStds.xK,
      a: input.pc1Vector[3],
      baseline: typicalBaseline.ketones,
    },
  ]

  // 3. Считаем PC₁ для каждого маркера на каждом из трёх уровней
  const pc1ByMarkerByLevel = {} as ZoneSystemResult['pc1ByMarkerByLevel']

  for (const m of markers) {
    const levels = input.clinicalThresholds[m.key]
    pc1ByMarkerByLevel[m.key] = {
      attention: calcPC1For(levels.attention, m.baseline, m.mean, m.std, m.a),
      exceeding: calcPC1For(levels.exceeding, m.baseline, m.mean, m.std, m.a),
      danger: calcPC1For(levels.danger, m.baseline, m.mean, m.std, m.a),
    }
  }

  // 4. Для каждого уровня — найти минимум по маркерам и определить driver
  const findMinByLevel = (level: 'attention' | 'exceeding' | 'danger') => {
    const entries = Object.entries(pc1ByMarkerByLevel).map(([key, vals]) => ({
      marker: key,
      value: vals[level],
    }))
    return entries.reduce((min, cur) => (cur.value < min.value ? cur : min))
  }

  const attentionMin = findMinByLevel('attention')
  const exceedingMin = findMinByLevel('exceeding')
  const dangerMin = findMinByLevel('danger')

  return {
    typicalBaseline,
    pc1ByMarkerByLevel,
    thresholds: {
      attention: attentionMin.value,
      exceeding: exceedingMin.value,
      danger: dangerMin.value,
    },
    drivingMarkers: {
      attention: attentionMin.marker,
      exceeding: exceedingMin.marker,
      danger: dangerMin.marker,
    },
  }
}

//Распределяем по зонам
export type ZoneDistribution = {
  zone1_norm: number // PC₁ < attention
  zone2_moderate: number // attention ≤ PC₁ < exceeding
  zone3_pronounced: number // exceeding ≤ PC₁ < danger
  zone4_critical: number // PC₁ ≥ danger
  total: number
  percentByZone: {
    zone1: number
    zone2: number
    zone3: number
    zone4: number
  }
}

/**
 * Распределяет наблюдения PC₁ по четырём зонам системы.
 */
export function distributeByZones(
  pc1Values: number[],
  thresholds: ZoneSystemResult['thresholds']
): ZoneDistribution {
  let zone1 = 0,
    zone2 = 0,
    zone3 = 0,
    zone4 = 0

  for (const v of pc1Values) {
    if (v < thresholds.attention) zone1++
    else if (v < thresholds.exceeding) zone2++
    else if (v < thresholds.danger) zone3++
    else zone4++
  }

  const total = pc1Values.length
  return {
    zone1_norm: zone1,
    zone2_moderate: zone2,
    zone3_pronounced: zone3,
    zone4_critical: zone4,
    total,
    percentByZone: {
      zone1: (100 * zone1) / total,
      zone2: (100 * zone2) / total,
      zone3: (100 * zone3) / total,
      zone4: (100 * zone4) / total,
    },
  }
}

//Прогноз для одной тренировки:
/**
 * Прогноз биохимического отклика для одной планируемой тренировки.
 *
 * Использует обученную ridge-модель и четырёхзонную систему PC₁
 * для оценки ожидаемого функционального состояния спортсмена
 * при заданных параметрах нагрузки.
 *
 * @param baseline    индивидуальная норма спортсмена (V̄, P̄, R̄)
 * @param session     планируемая тренировка (V, P, R)
 * @param artifacts   обученная модель (β, пороги, RMSE)
 */
export function forecastSession(
  baseline: AthleteBaseline,
  session: ProposedSession,
  artifacts: ModelArtifacts
): SessionForecast {
  // 1. Валидация
  validateBaseline(baseline)
  validateSession(session)

  // 2. Расчёт относительных отклонений
  const dV = (session.V - baseline.V) / baseline.V
  const dP = (session.P - baseline.P) / baseline.P
  const dR = (session.R - baseline.R) / baseline.R

  // 3. Прогноз PC₁ по линейной модели
  const contributionV = artifacts.beta.V * dV
  const contributionP = artifacts.beta.P * dP
  const contributionR = artifacts.beta.R * dR
  const predictedPC1 = contributionV + contributionP + contributionR

  // 4. Доверительный интервал — ±1 RMSE (около 68% случаев в этом диапазоне)
  const confidenceInterval = {
    lower: predictedPC1 - artifacts.cvRMSE,
    upper: predictedPC1 + artifacts.cvRMSE,
  }

  // 5. Определение зоны
  const zone = determineZone(predictedPC1, artifacts.thresholds)

  // 6. Раскладка по факторам (для интерпретации)
  const contributions = calculateContributions(contributionV, contributionP, contributionR)

  // 7. Главный фактор
  const dominantFactor = findDominantFactor(contributions)

  // 8. Текстовая рекомендация
  const recommendation = buildRecommendation(zone, dominantFactor, contributions)

  return {
    deltas: { dV, dP, dR },
    predictedPC1,
    confidenceInterval,
    zone,
    contributions,
    dominantFactor,
    recommendation,
  }
}

// ─── Вспомогательные функции ──────────────────────────────────────────

function validateBaseline(b: AthleteBaseline): void {
  if (b.V <= 0 || b.P <= 0 || b.R <= 0) {
    throw new Error('Baseline values must be positive')
  }
  if (![b.V, b.P, b.R].every(Number.isFinite)) {
    throw new Error('Baseline values must be finite numbers')
  }
}

function validateSession(s: ProposedSession): void {
  if (s.V < 0 || s.P < 0 || s.R < 0) {
    throw new Error('Session values must be non-negative')
  }
  if (![s.V, s.P, s.R].every(Number.isFinite)) {
    throw new Error('Session values must be finite numbers')
  }
}

function determineZone(
  pc1: number,
  thresholds: ModelArtifacts['thresholds']
): SessionForecast['zone'] {
  if (pc1 < thresholds.attention) {
    return {
      code: 1,
      name: 'Норма',
      color: 'green',
      description:
        'Все маркеры ожидаются в пределах общеклинической нормы. Биохимических признаков стресс-ответа не прогнозируется.',
    }
  }
  if (pc1 < thresholds.exceeding) {
    return {
      code: 2,
      name: 'Умеренный отклик',
      color: 'yellow',
      description:
        'Ожидается превышение общеклинической нормы по креатинину, типичная адаптационная реакция. Штатный режим тренировки.',
    }
  }
  if (pc1 < thresholds.danger) {
    return {
      code: 3,
      name: 'Выраженный отклик',
      color: 'red',
      description:
        'Прогнозируется достижение клинически значимого уровня по миоглобину. Требуется усиленный контроль восстановления.',
    }
  }
  return {
    code: 4,
    name: 'Критический отклик',
    color: 'black',
    description:
      'Ожидается выход маркеров на уровень клинически выраженной патологии. Рекомендуется коррекция нагрузки и углублённое наблюдение.',
  }
}

export type AthleteBaseline = {
  V: number // индивидуальный средний объём (например, кг или метры)
  P: number // индивидуальная средняя интенсивность (например, % от max)
  R: number // индивидуальное среднее восстановление (часы)
}

export type ProposedSession = {
  V: number
  P: number
  R: number
}

export type ModelArtifacts = {
  /** Коэффициенты ridge-регрессии в исходном масштабе (из descaleCoefficients) */
  beta: { V: number; P: number; R: number }

  /** Пороги PC₁ для четырёх зон (из calculateFourZoneSystem) */
  thresholds: {
    attention: number // граница: норма → умеренный отклик
    exceeding: number // граница: умеренный → выраженный
    danger: number // граница: выраженный → критический
  }

  /** Метрика качества модели для расчёта доверительного интервала */
  cvRMSE: number
  loadStds: { dV: number; dP: number; dR: number }
  loadRanges: {
    // ← добавили
    dV: { min: number; max: number }
    dP: { min: number; max: number }
    dR: { min: number; max: number }
  }
}

export type SessionForecast = {
  /** Относительные отклонения от индивидуальной нормы */
  deltas: { dV: number; dP: number; dR: number }

  /** Прогноз PC₁ */
  predictedPC1: number

  /** Доверительный интервал прогноза (±RMSE) */
  confidenceInterval: { lower: number; upper: number }

  /** Зона функционального состояния */
  zone: {
    code: 1 | 2 | 3 | 4
    name: 'Норма' | 'Умеренный отклик' | 'Выраженный отклик' | 'Критический отклик'
    description: string
    color: 'green' | 'yellow' | 'red' | 'black'
  }

  /** Раскладка прогноза по факторам нагрузки */
  contributions: {
    volume: { value: number; percent: number }
    pace: { value: number; percent: number }
    recovery: { value: number; percent: number }
  }

  /** Главный фактор, определяющий прогноз */
  dominantFactor: 'volume' | 'pace' | 'recovery'

  /** Текстовая рекомендация тренеру */
  recommendation: string
}

function calculateContributions(
  cV: number,
  cP: number,
  cR: number
): SessionForecast['contributions'] {
  // Считаем по модулям, чтобы знак вклада не искажал процент
  const totalAbs = Math.abs(cV) + Math.abs(cP) + Math.abs(cR)

  const percent = (value: number) =>
    totalAbs === 0 ? 0 : Math.round((100 * Math.abs(value)) / totalAbs)

  return {
    volume: { value: cV, percent: percent(cV) },
    pace: { value: cP, percent: percent(cP) },
    recovery: { value: cR, percent: percent(cR) },
  }
}

function findDominantFactor(
  c: SessionForecast['contributions']
): SessionForecast['dominantFactor'] {
  const factors: Array<{ name: SessionForecast['dominantFactor']; abs: number }> = [
    { name: 'volume', abs: Math.abs(c.volume.value) },
    { name: 'pace', abs: Math.abs(c.pace.value) },
    { name: 'recovery', abs: Math.abs(c.recovery.value) },
  ]
  factors.sort((a, b) => b.abs - a.abs)
  return factors[0].name
}

function buildRecommendation(
  zone: SessionForecast['zone'],
  dominant: SessionForecast['dominantFactor'],
  contributions: SessionForecast['contributions']
): string {
  const factorNames: Record<SessionForecast['dominantFactor'], string> = {
    volume: 'объём',
    pace: 'интенсивность',
    recovery: 'восстановление',
  }

  if (zone.code === 1) {
    return 'Нагрузка лёгкая. Подходит для втягивающих или восстановительных микроциклов.'
  }

  if (zone.code === 2) {
    return `Штатная тренировочная нагрузка. Основной фактор — ${factorNames[dominant]}. Подходит для базовых микроциклов.`
  }

  if (zone.code === 3) {
    const dominantContribution = contributions[dominant].value
    const action =
      dominantContribution > 0
        ? `снижение ${factorNames[dominant]}а`
        : `увеличение ${factorNames[dominant]}а (восстановления)`
    return `Серьёзный отклик. Если требуется коррекция, наиболее эффективно ${action}. Подходит для ударных микроциклов с обязательным последующим восстановлением.`
  }

  // zone.code === 4
  return `Критический отклик. Рекомендуется снизить нагрузку. Главный фактор перегрузки — ${factorNames[dominant]}. Целесообразно использовать только в ударных тренировках под медицинским контролем.`
}

export type LoadRanges = {
  dV: { min: number; max: number }
  dP: { min: number; max: number }
  dR: { min: number; max: number }
}

/**
 * Вычисляет диапазоны (min/max) нормализованных нагрузок
 * по всей обучающей выборке.
 *
 * Используется для проверки реалистичности рекомендаций
 * в обратной задаче — чтобы определить, не выходит ли
 * предложенная нагрузка за пределы диапазона, на котором
 * обучалась модель.
 *
 * @param rows массив строк с нормализованными нагрузками
 *             (после normalizeLoads)
 */
export function calculateLoadRanges(rows: FlatRowWithLoads[]): LoadRanges {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('calculateLoadRanges requires non-empty array')
  }

  // Инициализация — первое значение становится начальным min и max
  let minDV = rows[0].dV
  let maxDV = rows[0].dV
  let minDP = rows[0].dP
  let maxDP = rows[0].dP
  let minDR = rows[0].dR
  let maxDR = rows[0].dR

  // Один проход по всем строкам
  for (const row of rows) {
    if (!Number.isFinite(row.dV) || !Number.isFinite(row.dP) || !Number.isFinite(row.dR)) {
      throw new Error(`Invalid dV/dP/dR for athlete ${row.athleteId}, session ${row.sessionId}`)
    }

    if (row.dV < minDV) minDV = row.dV
    if (row.dV > maxDV) maxDV = row.dV

    if (row.dP < minDP) minDP = row.dP
    if (row.dP > maxDP) maxDP = row.dP

    if (row.dR < minDR) minDR = row.dR
    if (row.dR > maxDR) maxDR = row.dR
  }

  return {
    dV: { min: minDV, max: maxDV },
    dP: { min: minDP, max: maxDP },
    dR: { min: minDR, max: maxDR },
  }
}
