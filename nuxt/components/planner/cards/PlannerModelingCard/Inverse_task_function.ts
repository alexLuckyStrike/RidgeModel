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
export type FlatRowWithLoads = {
  athleteId: string
  sessionId: string
  PC1: number
  dV: number
  dP: number
  dR: number
}
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

/**
 * Базовые стратегии решения обратной задачи.
 * Каждая стратегия принимает целевое изменение PC1 и возвращает
 * относительные отклонения нагрузки (dV, dP, dR), необходимые
 * для достижения этой цели.
 *
 * Все стратегии используют одну формулу модели:
 *   PC1 = beta.V * dV + beta.P * dP + beta.R * dR
 *
 * Различие — в дополнительных ограничениях, превращающих
 * многозначное уравнение в однозначное решение.
 */

export type Beta = {
  V: number
  P: number
  R: number
}

export type LoadDeltas = {
  dV: number
  dP: number
  dR: number
}

export type BasicStrategyId = 'volume_only' | 'pace_only' | 'recovery_only' | 'balanced'

export type StrategyFn = (targetDelta: number, beta: Beta) => LoadDeltas

// Стратегия 1: Только объём
// Ограничения: dP = 0, dR = 0
// Решение: dV = targetDelta / beta.V
export function strategyVolumeOnly(targetDelta: number, beta: Beta): LoadDeltas {
  if (beta.V === 0) {
    throw new Error('strategyVolumeOnly: beta.V cannot be zero')
  }

  return {
    dV: targetDelta / beta.V,
    dP: 0,
    dR: 0,
  }
}

// Стратегия 2: Только интенсивность
// Ограничения: dV = 0, dR = 0
// Решение: dP = targetDelta / beta.P
export function strategyPaceOnly(targetDelta: number, beta: Beta): LoadDeltas {
  if (beta.P === 0) {
    throw new Error('strategyPaceOnly: beta.P cannot be zero')
  }

  return {
    dV: 0,
    dP: targetDelta / beta.P,
    dR: 0,
  }
}

// Стратегия 3: Только восстановление
// Ограничения: dV = 0, dP = 0
// Решение: dR = targetDelta / beta.R
// Внимание: beta.R отрицательный — поэтому при цели увеличить PC1
// восстановление сокращается (dR отрицательный).
export function strategyRecoveryOnly(targetDelta: number, beta: Beta): LoadDeltas {
  if (beta.R === 0) {
    throw new Error('strategyRecoveryOnly: beta.R cannot be zero')
  }

  return {
    dV: 0,
    dP: 0,
    dR: targetDelta / beta.R,
  }
}

// Стратегия 4: Сбалансированная
// Ограничения: dR = 0, contribution_V = contribution_P
// Решение:
//   dV = targetDelta / (2 * beta.V)
//   dP = targetDelta / (2 * beta.P)
export function strategyBalanced(targetDelta: number, beta: Beta): LoadDeltas {
  if (beta.V === 0 || beta.P === 0) {
    throw new Error('strategyBalanced: beta.V and beta.P cannot be zero')
  }

  const halfDelta = targetDelta / 2

  return {
    dV: halfDelta / beta.V,
    dP: halfDelta / beta.P,
    dR: 0,
  }
}

// Словарь стратегий — позволяет вызывать стратегию по её ID
export const BASIC_STRATEGIES: Record<BasicStrategyId, StrategyFn> = {
  volume_only: strategyVolumeOnly,
  pace_only: strategyPaceOnly,
  recovery_only: strategyRecoveryOnly,
  balanced: strategyBalanced,
}

// Человекочитаемые имена стратегий
export const STRATEGY_NAMES: Record<BasicStrategyId, string> = {
  volume_only: 'Только объём',
  pace_only: 'Только интенсивность',
  recovery_only: 'Только восстановление',
  balanced: 'Сбалансированная',
}

/// Функция для проверки реалистичности рекомендаций
export type LoadStds = {
  dV: number
  dP: number
  dR: number
}

export type RealismStatus = 'good' | 'caution' | 'avoid'

export type RealismCheck = {
  status: RealismStatus
  reason: string
  details: {
    statistical: {
      level: number // 0 = good, 1 = caution, 2 = avoid
      maxRatio: number // максимальная кратность σ среди V, P, R
      worstParam: 'V' | 'P' | 'R' // какой параметр самый "проблемный" по статистике
    }
    range: {
      level: number
      maxOvershoot: number // максимальный относительный выход за диапазон
      worstParam: 'V' | 'P' | 'R'
    }
  }
}

// Уровни проверки в виде констант для понятности
const STAT_THRESHOLDS = { good: 2, caution: 3 }
const RANGE_THRESHOLDS = { good: 0, caution: 0.5 }

export function checkRealism(
  deltas: LoadDeltas,
  loadStds: LoadStds,
  loadRanges: LoadRanges
): RealismCheck {
  // 1. Статистическая проверка - кратность σ для каждого параметра
  const ratios = {
    V: Math.abs(deltas.dV) / loadStds.dV,
    P: Math.abs(deltas.dP) / loadStds.dP,
    R: Math.abs(deltas.dR) / loadStds.dR,
  }
  const maxRatio = Math.max(ratios.V, ratios.P, ratios.R)

  const worstStatParam = ratios.V === maxRatio ? 'V' : ratios.P === maxRatio ? 'P' : 'R'
  const statLevel = classifyStatistical(maxRatio)

  // 2. Проверка диапазона - попадание в [min, max]
  const overshoots = {
    V: calcOvershoot(deltas.dV, loadRanges.dV),
    P: calcOvershoot(deltas.dP, loadRanges.dP),
    R: calcOvershoot(deltas.dR, loadRanges.dR),
  }
  const maxOvershoot = Math.max(overshoots.V, overshoots.P, overshoots.R)
  const worstRangeParam =
    overshoots.V === maxOvershoot ? 'V' : overshoots.P === maxOvershoot ? 'P' : 'R'
  const rangeLevel = classifyRange(maxOvershoot)

  // 3. Финальный статус - худшая из двух проверок
  const finalLevel = Math.max(statLevel, rangeLevel)
  const status: RealismStatus = finalLevel === 0 ? 'good' : finalLevel === 1 ? 'caution' : 'avoid'

  // 4. Текстовое описание
  const reason = describeReason(statLevel, rangeLevel, maxRatio, maxOvershoot)

  return {
    status,
    reason,
    details: {
      statistical: { level: statLevel, maxRatio, worstParam: worstStatParam },
      range: { level: rangeLevel, maxOvershoot, worstParam: worstRangeParam },
    },
  }
}

// Расчёт overshoot - насколько delta выходит за диапазон [min, max]
// Возвращает долю от размаха диапазона
function calcOvershoot(delta: number, range: { min: number; max: number }): number {
  const span = range.max - range.min
  if (span === 0) return 0

  let raw = 0
  if (delta < range.min) raw = range.min - delta
  if (delta > range.max) raw = delta - range.max

  return raw / span
}

function classifyStatistical(ratio: number): number {
  if (ratio <= STAT_THRESHOLDS.good) return 0
  if (ratio <= STAT_THRESHOLDS.caution) return 1
  return 2
}

function classifyRange(overshoot: number): number {
  if (overshoot < 0.01) return 0 // < 1% размаха = good
  if (overshoot <= RANGE_THRESHOLDS.caution) return 1
  return 2
}

function describeReason(
  statLevel: number,
  rangeLevel: number,
  ratio: number,
  overshoot: number
): string {
  // Если всё в норме
  if (statLevel === 0 && rangeLevel === 0) {
    return 'В пределах типичных тренировочных нагрузок'
  }

  const parts: string[] = []

  // Описание статистической проблемы
  if (statLevel === 1) {
    parts.push(`статистически на границе нормы (${ratio.toFixed(1)}σ)`)
  } else if (statLevel === 2) {
    parts.push(`статистически экстремально (${ratio.toFixed(1)}σ)`)
  }

  // Описание проблемы с диапазоном
  if (rangeLevel === 1) {
    parts.push(`выходит за диапазон обучающих данных на ${(overshoot * 100).toFixed(0)}% размаха`)
  } else if (rangeLevel === 2) {
    parts.push(
      `значительно выходит за диапазон обучающих данных на ${(overshoot * 100).toFixed(0)}% размаха`
    )
  }

  return parts.join('; ')
}
export function strategyVariative(targetDelta: number, beta: Beta, loadStds: LoadStds): LoadDeltas {
  if (beta.V === 0 || beta.P === 0 || beta.R === 0) {
    throw new Error('strategyVariative: all beta values must be non-zero')
  }

  if (loadStds.dV === 0 || loadStds.dP === 0 || loadStds.dR === 0) {
    throw new Error('strategyVariative: all loadStds must be non-zero')
  }

  if (targetDelta === 0) {
    return { dV: 0, dP: 0, dR: 0 }
  }

  // Нагрузочный режим - все три параметра растут
  if (targetDelta > 0) {
    const denom = beta.V * loadStds.dV + beta.P * loadStds.dP + beta.R * loadStds.dR

    if (denom === 0) {
      throw new Error('strategyVariative: division by zero in load mode')
    }

    const k = targetDelta / denom

    return {
      dV: k * loadStds.dV,
      dP: k * loadStds.dP,
      dR: k * loadStds.dR,
    }
  }

  // Восстановительный режим - V и P снижаются, R удлиняется
  const denom = beta.V * loadStds.dV + beta.P * loadStds.dP - beta.R * loadStds.dR

  if (denom === 0) {
    throw new Error('strategyVariative: division by zero in recover mode')
  }

  const m = -targetDelta / denom

  return {
    dV: -m * loadStds.dV,
    dP: -m * loadStds.dP,
    dR: m * loadStds.dR,
  }
}
/// exploreVariativeStrategy - функция для исследования вариативной стратегии на сетке параметров
// Конфигурация четырёхзонной системы

export type ZoneNumber = 1 | 2 | 3 | 4
export type ZoneInfo = {
  number: ZoneNumber
  name: string
  center: number // целевое PC₁ (центр зоны)
  drivingMarker: string // маркер, определяющий границу зоны
}

// Центры зон — целевые значения PC₁ для каждой зоны
// Зоны 2 и 3 — середины (между порогами)
// Зоны 1 и 4 — условные центры (зоны открыты с одной стороны)
export const ZONE_INFO: Record<ZoneNumber, ZoneInfo> = {
  1: {
    number: 1,
    name: 'Норма',
    center: -2.5,
    drivingMarker: 'креатинин',
  },
  2: {
    number: 2,
    name: 'Умеренный отклик',
    center: -0.66,
    drivingMarker: 'креатинин',
  },
  3: {
    number: 3,
    name: 'Выраженный отклик',
    center: 1.04,
    drivingMarker: 'миоглобин',
  },
  4: {
    number: 4,
    name: 'Критический отклик',
    center: 1.7,
    drivingMarker: 'креатинин',
  },
}

export const ZONE_NUMBERS: ZoneNumber[] = [1, 2, 3, 4]

export type StrategyId = 'volume_only' | 'pace_only' | 'recovery_only' | 'balanced' | 'variative'
export type StrategyInfo = {
  id: StrategyId
  name: string
  description: string
}
export const STRATEGY_INFO: Record<StrategyId, StrategyInfo> = {
  volume_only: {
    id: 'volume_only',
    name: 'Только объём',
    description: 'Изменение только объёма тренировки. P и R остаются в норме.',
  },
  pace_only: {
    id: 'pace_only',
    name: 'Только интенсивность',
    description: 'Изменение только интенсивности. V и R остаются в норме.',
  },
  recovery_only: {
    id: 'recovery_only',
    name: 'Только восстановление',
    description: 'Изменение только восстановления. V и P остаются в норме.',
  },
  balanced: {
    id: 'balanced',
    name: 'Сбалансированная',
    description: 'Объём и интенсивность изменяются пропорционально, R в норме.',
  },
  variative: {
    id: 'variative',
    name: 'Вариативная',
    description: 'Все три параметра используются одновременно.',
  },
}

// Универсальный вызов стратегии по её ID
// Вариативная требует loadStds, остальные — только beta
export function callStrategy(
  id: StrategyId,
  targetDelta: number,
  beta: Beta,
  loadStds: LoadStds
): LoadDeltas {
  switch (id) {
    case 'volume_only':
      return strategyVolumeOnly(targetDelta, beta)
    case 'pace_only':
      return strategyPaceOnly(targetDelta, beta)
    case 'recovery_only':
      return strategyRecoveryOnly(targetDelta, beta)
    case 'balanced':
      return strategyBalanced(targetDelta, beta)
    case 'variative':
      return strategyVariative(targetDelta, beta, loadStds)
  }
}

export const STRATEGY_IDS: StrategyId[] = [
  'volume_only',
  'pace_only',
  'recovery_only',
  'balanced',
  'variative',
]

export type LoadBaseline = {
  V: number // объём (кг)
  P: number // интенсивность (%)
  R: number // восстановление (мин)
}

export type Session = {
  V: number // кг
  P: number // %
  R: number // мин
}

// Применение дельт к индивидуальной норме спортсмена
// Возвращает конкретные значения тренировки
export function applyDeltasToBaseline(deltas: LoadDeltas, baseline: LoadBaseline): Session {
  return {
    V: baseline.V * (1 + deltas.dV),
    P: baseline.P * (1 + deltas.dP),
    R: baseline.R * (1 + deltas.dR),
  }
}

// Прогноз PC₁ по дельтам (для верификации)
export function predictPC1FromDeltas(deltas: LoadDeltas, beta: Beta): number {
  return beta.V * deltas.dV + beta.P * deltas.dP + beta.R * deltas.dR
}

// Текстовое описание изменения для тренера
export function describeChange(deltas: LoadDeltas): string {
  const parts: string[] = []

  const formatDelta = (label: string, value: number): string => {
    const sign = value >= 0 ? '+' : ''
    return `${label} ${sign}${(value * 100).toFixed(1)}%`
  }

  if (Math.abs(deltas.dV) > 0.001) parts.push(formatDelta('V', deltas.dV))
  if (Math.abs(deltas.dP) > 0.001) parts.push(formatDelta('P', deltas.dP))
  if (Math.abs(deltas.dR) > 0.001) parts.push(formatDelta('R', deltas.dR))

  if (parts.length === 0) return 'Без изменений'
  return parts.join(', ')
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

export type ExplorationInput = {
  baseline: LoadBaseline
  artifacts: ModelArtifacts
  fromPC1?: number // опорная точка, по умолчанию 0
}

export type ZoneVariant = {
  // Целевая зона
  targetZone: ZoneNumber
  zoneName: string
  targetPC1: number
  drivingMarker: string

  // Конкретная тренировка
  session: Session

  // Относительные изменения
  deltas: { dV: number; dP: number; dR: number }

  // Прогноз модели (для верификации)
  predictedPC1: number

  // Проверка реалистичности
  realism: RealismCheck

  // Текстовое описание
  description: string
}

export type StrategyExploration = {
  id: StrategyId
  name: string
  description: string
  variants: ZoneVariant[]
}

export type ExplorationResult = {
  baseline: LoadBaseline
  fromPC1: number
  zones: ZoneInfo[]
  strategies: StrategyExploration[]
}

/**
 * Главная функция обратной задачи.
 * Возвращает все 5 стратегий, каждая с 4 вариантами (по одному на зону).
 *
 * Использование в UI: тренер выбирает стратегию через переключатель,
 * получает 4 варианта тренировки (по зонам).
 */
export function exploreStrategy(input: ExplorationInput): ExplorationResult {
  const fromPC1 = input.fromPC1 ?? 0

  // Для каждой стратегии — обрабатываем все 4 зоны
  const strategies: StrategyExploration[] = STRATEGY_IDS.map((strategyId) => {
    return buildStrategyExploration(strategyId, input.baseline, input.artifacts, fromPC1)
  })

  return {
    baseline: input.baseline,
    fromPC1,
    zones: ZONE_NUMBERS.map((n) => ZONE_INFO[n]),
    strategies,
  }
}

// Построение одной стратегии — 4 варианта по зонам
function buildStrategyExploration(
  strategyId: StrategyId,
  baseline: LoadBaseline,
  artifacts: ModelArtifacts,
  fromPC1: number
): StrategyExploration {
  const info = STRATEGY_INFO[strategyId]

  const variants: ZoneVariant[] = ZONE_NUMBERS.map((zoneNum) =>
    buildZoneVariant(strategyId, zoneNum, baseline, artifacts, fromPC1)
  )

  return {
    id: info.id,
    name: info.name,
    description: info.description,
    variants,
  }
}

// Построение одного варианта — для конкретной зоны и стратегии
function buildZoneVariant(
  strategyId: StrategyId,
  zoneNum: ZoneNumber,
  baseline: LoadBaseline,
  artifacts: ModelArtifacts,
  fromPC1: number
): ZoneVariant {
  const zoneInfo = ZONE_INFO[zoneNum]
  const targetPC1 = zoneInfo.center
  const targetDelta = targetPC1 - fromPC1

  // Вызываем стратегию
  const deltas = callStrategy(strategyId, targetDelta, artifacts.beta, artifacts.loadStds)

  // Применяем дельты к baseline
  const session = applyDeltasToBaseline(deltas, baseline)

  // Прогноз для верификации
  const predictedPC1 = predictPC1FromDeltas(deltas, artifacts.beta)

  // Проверка реалистичности
  const realism = checkRealism(deltas, artifacts.loadStds, artifacts.loadRanges)

  // Текстовое описание
  const description = describeChange(deltas)

  return {
    targetZone: zoneNum,
    zoneName: zoneInfo.name,
    targetPC1,
    drivingMarker: zoneInfo.drivingMarker,
    session,
    deltas: { dV: deltas.dV, dP: deltas.dP, dR: deltas.dR },
    predictedPC1,
    realism,
    description,
  }
}
