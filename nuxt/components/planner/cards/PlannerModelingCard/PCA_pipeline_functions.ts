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
