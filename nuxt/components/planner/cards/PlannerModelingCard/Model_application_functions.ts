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
