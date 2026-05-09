// релятивистское среднее - относительно базовой линии

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

//// 2 часть. Ковариационная матрица и PCA

// Проекция на PC1
export type FlatRowWithPC1 = {
  athleteId: string
  sessionId: string
  V: number
  P: number
  R: number
  PC1: number
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
