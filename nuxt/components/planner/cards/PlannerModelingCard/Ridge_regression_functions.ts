import { transposeMatrix, multiplyMatrices } from './loads_and_matrix'

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
