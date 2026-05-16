// ============================================================
// createMesoCycle.js
// Единый модуль построения мезоциклов
// Один файл, один импорт
// ============================================================

import { createCatalog } from './microcycle'
// ======================== ХЕЛПЕРЫ ==========================

/**
 * Рассчитать метаданные мезоцикла по массиву недель.
 */
function computeMesoMetadata(weeks) {
  const weeklyPC1 = weeks.map((w) => w.microCycle.metadata.averagePC1)
  const n = weeklyPC1.length

  const averagePC1 = weeklyPC1.reduce((a, b) => a + b, 0) / n

  const deltas = []
  for (let i = 1; i < n; i++) {
    deltas.push(Math.round((weeklyPC1[i] - weeklyPC1[i - 1]) * 100) / 100)
  }

  const totalDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const totalRealismProfile = { good: 0, caution: 0, avoid: 0 }
  let totalSessions = 0

  for (const week of weeks) {
    const d = week.microCycle.metadata.distribution
    const r = week.microCycle.metadata.realismProfile
    for (const z of [1, 2, 3, 4]) totalDistribution[z] += d[z] || 0
    for (const s of ['good', 'caution', 'avoid']) totalRealismProfile[s] += r[s] || 0
    totalSessions += week.microCycle.sessions.length
  }

  return {
    weeklyPC1,
    averagePC1: Math.round(averagePC1 * 100) / 100,
    deltas,
    totalDistribution,
    totalRealismProfile,
    totalSessions,
    weekCount: n,
  }
}

// ============================================================
// АДАПТИВНЫЙ ПОДБОР МИКРОЦИКЛОВ
// ============================================================

/**
 * Уровни нагрузки для шаблонов мезоцикла.
 *
 * Каждый уровень задаёт:
 *   - types:    типы микроциклов (пул кандидатов)
 *   - pc1Range: [min, max] допустимый диапазон среднего PC1
 *   - noZone3:  true = микроцикл не должен содержать Зону 3/4
 *
 * Билдер выбирает из каталога тот микроцикл, чей PC1 ближе
 * к центру диапазона и проходит все фильтры.
 */
const LOAD_LEVELS = {
  // --- Уровни втягивающего мезоцикла ---
  lowest: { types: ['recovery'], pc1Range: [-3.0, -1.8], noZone3: true },
  low: { types: ['recovery', 'recovery_intro'], pc1Range: [-2.2, -1.5], noZone3: true },
  medium: { types: ['recovery_intro'], pc1Range: [-1.8, -1.0], noZone3: true, prefer: 'low' },
  high: { types: ['recovery_intro'], pc1Range: [-1.7, -0.8], noZone3: true, prefer: 'high' },
  bridge: { types: ['base'], pc1Range: [-0.8, -0.3], noZone3: true },

  // --- Уровни базового мезоцикла ---
  // PC1 лестница: unload(−1.58) → base_low(−0.66) → base_mid(−0.09) → base_high(+0.08)
  unload: { types: ['recovery_intro'], pc1Range: [-2.0, -1.0], noZone3: true },
  base_low: { types: ['base'], pc1Range: [-0.8, -0.3], noZone3: true },
  base_mid: { types: ['base'], pc1Range: [-0.8, 0.0], noZone3: false, prefer: 'high' },
  base_high: { types: ['shock'], pc1Range: [-0.2, 0.5], noZone3: false },

  // --- Уровни развивающего мезоцикла ---
  // PC1 лестница: shock_unload(−1.58) → shock_support(−0.66) → shock_low(−0.14..0) → shock_mid(0..+0.2) → shock_high(+0.2..+0.5)
  shock_unload: { types: ['recovery_intro'], pc1Range: [-2.0, -1.0], noZone3: true },
  shock_support: { types: ['base'], pc1Range: [-0.8, -0.3], noZone3: true },
  shock_low: { types: ['shock'], pc1Range: [-0.2, 0.2], noZone3: false, prefer: 'low' },
  shock_mid: { types: ['shock'], pc1Range: [-0.2, 0.5], noZone3: false, prefer: 'low' },
  shock_high: { types: ['shock'], pc1Range: [-0.1, 0.5], noZone3: false, prefer: 'high' },

  // --- Уровни предсоревновательного мезоцикла ---
  // PC1 лестница: taper_start(−0.66) → taper_mid(−1.27) → taper_low(−1.58) → taper_finish(−2.0..−2.5)
  taper_start: { types: ['base'], pc1Range: [-0.8, -0.3], noZone3: true },
  taper_mid: { types: ['taper'], pc1Range: [-1.7, -0.6], noZone3: true },
  taper_low: { types: ['taper', 'recovery_intro'], pc1Range: [-2.0, -1.0], noZone3: true },
  taper_finish: { types: ['recovery', 'recovery_intro'], pc1Range: [-3.0, -1.5], noZone3: true },

  // --- Уровни восстановительного мезоцикла ---
  // PC1 лестница: rec_deep(−2.50) → rec_mid(−2.0) → rec_light(−1.58) → rec_exit(−1.27)
  rec_deep: { types: ['recovery'], pc1Range: [-3.0, -2.0], noZone3: true },
  rec_mid: { types: ['recovery'], pc1Range: [-2.5, -1.5], noZone3: true },
  rec_light: {
    types: ['recovery', 'recovery_intro'],
    pc1Range: [-2.2, -1.3],
    noZone3: true,
    prefer: 'high',
  },
  rec_exit: { types: ['recovery_intro'], pc1Range: [-1.8, -1.0], noZone3: true, prefer: 'high' },
}

/**
 * Найти лучший микроцикл для заданного уровня нагрузки.
 *
 * @param {Object} microCatalogs   - каталоги микроциклов
 * @param {string} level           - ключ из LOAD_LEVELS
 * @param {number} sessionsPerWeek
 * @param {Set}    usedKeys        - уже использованные type/variant
 * @returns {{ micro: Object, key: string }|null}
 */
function selectMicroForLevel(microCatalogs, level, sessionsPerWeek, usedKeys) {
  const spec = LOAD_LEVELS[level]
  if (!spec) return null

  const [minPC1, maxPC1] = spec.pc1Range
  const centerPC1 = (minPC1 + maxPC1) / 2

  const candidates = []
  for (const type of spec.types) {
    const catalog = microCatalogs[type]
    if (!catalog) continue
    const variants = catalog[sessionsPerWeek]
    if (!variants) continue

    for (const v of variants) {
      if (!v.validation.valid) continue

      const pc1 = v.metadata.averagePC1
      if (pc1 < minPC1 || pc1 > maxPC1) continue

      if (spec.noZone3) {
        const z3z4 = (v.metadata.distribution[3] || 0) + (v.metadata.distribution[4] || 0)
        if (z3z4 > 0) continue
      }

      const key = `${type}/${v.variantId}`
      candidates.push({
        micro: v,
        key,
        pc1,
        distToCenter: Math.abs(pc1 - centerPC1),
        isUsed: usedKeys.has(key),
      })
    }
  }

  if (candidates.length === 0) return null

  // Определяем стратегию сортировки
  const prefer = spec.prefer || 'center'

  candidates.sort((a, b) => {
    // Неиспользованные сначала
    if (a.isUsed !== b.isUsed) return a.isUsed ? 1 : -1

    if (prefer === 'high') {
      // Предпочитаем максимальный PC1 (ближе к 0)
      return b.pc1 - a.pc1
    } else if (prefer === 'low') {
      // Предпочитаем минимальный PC1 (дальше от 0)
      return a.pc1 - b.pc1
    } else {
      // По умолчанию — ближе к центру диапазона
      return a.distToCenter - b.distToCenter
    }
  })

  return { micro: candidates[0].micro, key: candidates[0].key }
}

// ======================== ШАБЛОНЫ ==========================

function getMesoTemplates(type) {
  switch (type) {
    case 'recovery_intro':
      return getRecoveryIntroMesoTemplates()
    case 'base':
      return getBaseMesoTemplates()
    case 'shock':
      return getShockMesoTemplates()
    case 'taper':
      return getTaperMesoTemplates()
    case 'recovery':
      return getRecoveryMesoTemplates()
    default:
      throw new Error(`Неизвестный тип мезоцикла: ${type}`)
  }
}

/**
 * Шаблоны втягивающего мезоцикла.
 *
 * Каждая неделя задаёт level (уровень нагрузки).
 * Билдер адаптивно подберёт подходящий микроцикл
 * для конкретного sessionsPerWeek.
 *
 * 5 уровней (от низкого к высокому):
 *   lowest  → recovery            (PC1 ≈ −2.5..−1.8)
 *   low     → recovery/rec_intro  (PC1 ≈ −2.2..−1.5)
 *   medium  → recovery_intro      (PC1 ≈ −1.8..−1.0)
 *   high    → recovery_intro      (PC1 ≈ −1.5..−0.8)
 *   bridge  → base                (PC1 ≈ −0.8..−0.3)
 */
function getRecoveryIntroMesoTemplates() {
  return {
    2: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Линейный разгон',
        dynamics: 'ascending',
        context: 'Восстановительный → втягивающий. Классический вход после перерыва.',
        weeks: [
          { weekNumber: 1, level: 'lowest' },
          { weekNumber: 2, level: 'medium' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Разгон с мостиком',
        dynamics: 'ascending',
        context: 'Втягивающий → базовый. Быстрый переход к рабочему мезоциклу.',
        weeks: [
          { weekNumber: 1, level: 'medium' },
          { weekNumber: 2, level: 'bridge' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v3',
        name: 'Осторожный вход',
        dynamics: 'descending',
        context: 'Втягивающий → восстановительный. Спортсмен пробует и отступает.',
        weeks: [
          { weekNumber: 1, level: 'medium' },
          { weekNumber: 2, level: 'lowest' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v4',
        name: 'Равномерный низкий',
        dynamics: 'step',
        context: 'Два одинаковых по нагрузке микроцикла. Стабилизация.',
        weeks: [
          { weekNumber: 1, level: 'low' },
          { weekNumber: 2, level: 'low' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Равномерный средний',
        dynamics: 'step',
        context: 'Два средних микроцикла. Быстрый вход для подготовленных.',
        weeks: [
          { weekNumber: 1, level: 'medium' },
          { weekNumber: 2, level: 'medium' },
        ],
      },
    ],

    3: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Классический трёхнедельный',
        dynamics: 'ascending',
        context: 'Восстановительный → лёгкий → средний. Стандартный вход.',
        weeks: [
          { weekNumber: 1, level: 'lowest' },
          { weekNumber: 2, level: 'low' },
          { weekNumber: 3, level: 'medium' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Маятниковый вход',
        dynamics: 'pendulum',
        context: 'Средний → минимальный → средний. Волна для нестабильного восстановления.',
        weeks: [
          { weekNumber: 1, level: 'medium' },
          { weekNumber: 2, level: 'lowest' },
          { weekNumber: 3, level: 'medium' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Ступенчатый разгон',
        dynamics: 'step',
        context: 'Два восстановительных (плато) → один втягивающий (ступень).',
        weeks: [
          { weekNumber: 1, level: 'lowest' },
          { weekNumber: 2, level: 'lowest' },
          { weekNumber: 3, level: 'medium' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v4',
        name: 'Затухающий после перегрузки',
        dynamics: 'descending',
        context: 'Средний → низкий → минимальный. Хроническая перетренировка.',
        weeks: [
          { weekNumber: 1, level: 'medium' },
          { weekNumber: 2, level: 'low' },
          { weekNumber: 3, level: 'lowest' },
        ],
      },

      // --- НАРАСТАЮЩАЯ С МОСТИКОМ ---
      {
        variantId: 'v5',
        name: 'С мостиком к базовому',
        dynamics: 'ascending',
        context: 'Восстановительный → втягивающий → базовый. Плавный переход.',
        weeks: [
          { weekNumber: 1, level: 'lowest' },
          { weekNumber: 2, level: 'medium' },
          { weekNumber: 3, level: 'bridge' },
        ],
      },
    ],

    4: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Длинный линейный разгон',
        dynamics: 'ascending',
        context: 'Четыре ступени нарастания. После длительного межсезонья.',
        weeks: [
          { weekNumber: 1, level: 'lowest' },
          { weekNumber: 2, level: 'low' },
          { weekNumber: 3, level: 'medium' },
          { weekNumber: 4, level: 'high' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Двойной маятник',
        dynamics: 'pendulum',
        context: 'Средний → минимальный → средний → низкий. Медленное восстановление.',
        weeks: [
          { weekNumber: 1, level: 'medium' },
          { weekNumber: 2, level: 'lowest' },
          { weekNumber: 3, level: 'medium' },
          { weekNumber: 4, level: 'low' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Двухступенчатый',
        dynamics: 'step',
        context: 'Блок восстановительных → блок втягивающих. Две ступени.',
        weeks: [
          { weekNumber: 1, level: 'lowest' },
          { weekNumber: 2, level: 'lowest' },
          { weekNumber: 3, level: 'medium' },
          { weekNumber: 4, level: 'medium' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v4',
        name: 'Длинное затухание',
        dynamics: 'descending',
        context: 'Высокий → средний → низкий → минимальный. После травмы.',
        weeks: [
          { weekNumber: 1, level: 'high' },
          { weekNumber: 2, level: 'medium' },
          { weekNumber: 3, level: 'low' },
          { weekNumber: 4, level: 'lowest' },
        ],
      },

      // --- С МОСТИКОМ ---
      {
        variantId: 'v5',
        name: 'Трёхнедельный с мостиком',
        dynamics: 'ascending',
        context: 'Восстановительный → два втягивающих → базовый.',
        weeks: [
          { weekNumber: 1, level: 'lowest' },
          { weekNumber: 2, level: 'low' },
          { weekNumber: 3, level: 'medium' },
          { weekNumber: 4, level: 'bridge' },
        ],
      },
    ],
  }
}

/**
 * Шаблоны базового мезоцикла.
 *
 * Базовый мезоцикл — ядро тренировочного процесса.
 * Основная работа в Зоне 2 (базовая), допускаются Зоны 3 (развивающая).
 * Разгрузочные недели — recovery_intro.
 *
 * Уровни нагрузки:
 *   unload    → recovery_intro  (PC1 ≈ −2.0..−1.0)  — разгрузочная
 *   base_low  → base без Z3     (PC1 ≈ −0.8..−0.4)  — лёгкая базовая
 *   base_mid  → base            (PC1 ≈ −0.8..0.0)   — средняя базовая
 *   base_high → base/shock      (PC1 ≈ −0.3..+0.5)  — тяжёлая базовая
 */
function getBaseMesoTemplates() {
  return {
    2: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Линейный базовый',
        dynamics: 'ascending',
        context: 'Лёгкая базовая → средняя базовая. Стандартный вход в базовый блок.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_mid' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Базовый с усилением',
        dynamics: 'ascending',
        context: 'Лёгкая базовая → тяжёлая. Подготовка к ударному мезоциклу.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_high' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v3',
        name: 'Базовый с разгрузкой',
        dynamics: 'descending',
        context: 'Средняя базовая → разгрузочная. Классический цикл нагрузка-отдых.',
        weeks: [
          { weekNumber: 1, level: 'base_mid' },
          { weekNumber: 2, level: 'unload' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v4',
        name: 'Равномерный базовый',
        dynamics: 'step',
        context: 'Две лёгких базовых. Стабильная объёмная работа.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_low' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Базовый + средний',
        dynamics: 'ascending',
        context: 'Лёгкая базовая → средняя с развивающей. Прогрессия через зоны.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_mid' },
        ],
      },
    ],

    3: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Классический трёхнедельный',
        dynamics: 'ascending',
        context: 'Лёгкая → средняя → тяжёлая. Стандартная прогрессия нагрузки.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_mid' },
          { weekNumber: 3, level: 'base_high' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Маятниковый базовый',
        dynamics: 'pendulum',
        context: 'Средняя → разгрузочная → тяжёлая. Суперкомпенсация после разгрузки.',
        weeks: [
          { weekNumber: 1, level: 'base_mid' },
          { weekNumber: 2, level: 'unload' },
          { weekNumber: 3, level: 'base_high' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Ступенчатый базовый',
        dynamics: 'step',
        context: 'Две лёгких базовых → одна тяжёлая. Блочная прогрессия.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_low' },
          { weekNumber: 3, level: 'base_high' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v4',
        name: 'Базовый с затуханием',
        dynamics: 'descending',
        context: 'Тяжёлая → средняя → разгрузочная. Разгрузка после накопленной нагрузки.',
        weeks: [
          { weekNumber: 1, level: 'base_high' },
          { weekNumber: 2, level: 'base_mid' },
          { weekNumber: 3, level: 'unload' },
        ],
      },

      // --- НАРАСТАЮЩАЯ С РАЗГРУЗКОЙ ---
      {
        variantId: 'v5',
        name: 'Два базовых + разгрузка',
        dynamics: 'pendulum',
        context: 'Лёгкая → тяжёлая → разгрузочная. Классика 2+1.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_high' },
          { weekNumber: 3, level: 'unload' },
        ],
      },
    ],

    4: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Четырёхнедельная прогрессия',
        dynamics: 'ascending',
        context: 'Разгрузочная → лёгкая → средняя → тяжёлая. Плавный подъём.',
        weeks: [
          { weekNumber: 1, level: 'unload' },
          { weekNumber: 2, level: 'base_low' },
          { weekNumber: 3, level: 'base_mid' },
          { weekNumber: 4, level: 'base_high' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Двойная волна',
        dynamics: 'pendulum',
        context: 'Средняя → разгрузочная → тяжёлая → лёгкая. Волнообразная периодизация.',
        weeks: [
          { weekNumber: 1, level: 'base_mid' },
          { weekNumber: 2, level: 'unload' },
          { weekNumber: 3, level: 'base_high' },
          { weekNumber: 4, level: 'base_low' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Двухступенчатый базовый',
        dynamics: 'step',
        context: 'Блок лёгких → блок тяжёлых. Ступенчатая адаптация.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_low' },
          { weekNumber: 3, level: 'base_mid' },
          { weekNumber: 4, level: 'base_high' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v4',
        name: 'Базовый с длинной разгрузкой',
        dynamics: 'descending',
        context: 'Тяжёлая → средняя → лёгкая → разгрузочная. Глубокое восстановление.',
        weeks: [
          { weekNumber: 1, level: 'base_high' },
          { weekNumber: 2, level: 'base_mid' },
          { weekNumber: 3, level: 'base_low' },
          { weekNumber: 4, level: 'unload' },
        ],
      },

      // --- КЛАССИКА 3+1 ---
      {
        variantId: 'v5',
        name: 'Три рабочих + разгрузка',
        dynamics: 'pendulum',
        context: 'Лёгкая → средняя → тяжёлая → разгрузочная. Классическая схема 3+1.',
        weeks: [
          { weekNumber: 1, level: 'base_low' },
          { weekNumber: 2, level: 'base_mid' },
          { weekNumber: 3, level: 'base_high' },
          { weekNumber: 4, level: 'unload' },
        ],
      },
    ],
  }
}

/**
 * Шаблоны развивающего мезоцикла.
 *
 * Развивающий мезоцикл — блок максимальной нагрузки.
 * Ядро — ударные микроциклы (Зоны 3+4).
 * Обязательны разгрузочные или базовые недели для восстановления.
 *
 * Уровни нагрузки:
 *   shock_unload  → recovery_intro  (PC1 ≈ −1.58)  — разгрузочная
 *   shock_support → base без Z3     (PC1 ≈ −0.66)  — поддерживающая
 *   shock_low     → shock           (PC1 ≈ −0.14..0) — лёгкий ударный
 *   shock_mid     → shock           (PC1 ≈ 0..+0.2)  — средний ударный
 *   shock_high    → shock           (PC1 ≈ +0.2..+0.5) — тяжёлый ударный
 */
function getShockMesoTemplates() {
  return {
    2: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Ударный разгон',
        dynamics: 'ascending',
        context: 'Поддерживающая → ударная. Резкий вход в развивающий блок.',
        weeks: [
          { weekNumber: 1, level: 'shock_support' },
          { weekNumber: 2, level: 'shock_mid' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Двойной удар',
        dynamics: 'ascending',
        context: 'Лёгкий ударный → тяжёлый ударный. Максимальная стимуляция.',
        weeks: [
          { weekNumber: 1, level: 'shock_low' },
          { weekNumber: 2, level: 'shock_high' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v3',
        name: 'Удар + восстановление',
        dynamics: 'descending',
        context: 'Ударная → поддерживающая. Классический шок-адаптация.',
        weeks: [
          { weekNumber: 1, level: 'shock_high' },
          { weekNumber: 2, level: 'shock_support' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v4',
        name: 'Равномерный ударный',
        dynamics: 'step',
        context: 'Два ударных микроцикла одинаковой нагрузки. Устойчивый стресс.',
        weeks: [
          { weekNumber: 1, level: 'shock_low' },
          { weekNumber: 2, level: 'shock_low' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Удар + поддержка',
        dynamics: 'descending',
        context: 'Ударная → поддерживающая. Мягкий выход из шока.',
        weeks: [
          { weekNumber: 1, level: 'shock_mid' },
          { weekNumber: 2, level: 'shock_support' },
        ],
      },
    ],

    3: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Трёхнедельный разгон',
        dynamics: 'ascending',
        context: 'Поддерживающая → лёгкий ударный → тяжёлый. Прогрессия к пику.',
        weeks: [
          { weekNumber: 1, level: 'shock_support' },
          { weekNumber: 2, level: 'shock_low' },
          { weekNumber: 3, level: 'shock_high' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Маятниковый ударный',
        dynamics: 'pendulum',
        context: 'Ударная → разгрузочная → ударная. Суперкомпенсация между шоками.',
        weeks: [
          { weekNumber: 1, level: 'shock_mid' },
          { weekNumber: 2, level: 'shock_unload' },
          { weekNumber: 3, level: 'shock_high' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Ступенчатый ударный',
        dynamics: 'step',
        context: 'Поддерживающая + поддерживающая → ударная. Подготовка и удар.',
        weeks: [
          { weekNumber: 1, level: 'shock_support' },
          { weekNumber: 2, level: 'shock_support' },
          { weekNumber: 3, level: 'shock_high' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v4',
        name: 'Ударный с затуханием',
        dynamics: 'descending',
        context: 'Тяжёлая → средняя → разгрузочная. Разгрузка после шока.',
        weeks: [
          { weekNumber: 1, level: 'shock_high' },
          { weekNumber: 2, level: 'shock_low' },
          { weekNumber: 3, level: 'shock_unload' },
        ],
      },

      // --- МАЯТНИКОВАЯ (удар-поддержка-удар) ---
      {
        variantId: 'v5',
        name: 'Двойной удар с поддержкой',
        dynamics: 'pendulum',
        context: 'Ударная → поддерживающая → ударная. Два шока через базовый.',
        weeks: [
          { weekNumber: 1, level: 'shock_mid' },
          { weekNumber: 2, level: 'shock_support' },
          { weekNumber: 3, level: 'shock_high' },
        ],
      },
    ],

    4: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Длинная прогрессия к пику',
        dynamics: 'ascending',
        context: 'Поддерживающая → лёгкий → средний → тяжёлый. Четыре ступени к пику.',
        weeks: [
          { weekNumber: 1, level: 'shock_support' },
          { weekNumber: 2, level: 'shock_low' },
          { weekNumber: 3, level: 'shock_mid' },
          { weekNumber: 4, level: 'shock_high' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Волнообразный ударный',
        dynamics: 'pendulum',
        context: 'Ударная → разгрузочная → тяжёлая → поддерживающая. Двойная волна.',
        weeks: [
          { weekNumber: 1, level: 'shock_mid' },
          { weekNumber: 2, level: 'shock_unload' },
          { weekNumber: 3, level: 'shock_high' },
          { weekNumber: 4, level: 'shock_support' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Двухступенчатый ударный',
        dynamics: 'step',
        context: 'Блок поддерживающих → блок ударных. Ступенчатая стимуляция.',
        weeks: [
          { weekNumber: 1, level: 'shock_support' },
          { weekNumber: 2, level: 'shock_support' },
          { weekNumber: 3, level: 'shock_mid' },
          { weekNumber: 4, level: 'shock_high' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v4',
        name: 'Ударный с длинным восстановлением',
        dynamics: 'descending',
        context: 'Тяжёлая → средняя → поддерживающая → разгрузочная. Глубокая адаптация.',
        weeks: [
          { weekNumber: 1, level: 'shock_high' },
          { weekNumber: 2, level: 'shock_low' },
          { weekNumber: 3, level: 'shock_support' },
          { weekNumber: 4, level: 'shock_unload' },
        ],
      },

      // --- КЛАССИКА 2+1+1 ---
      {
        variantId: 'v5',
        name: 'Два ударных + поддержка + разгрузка',
        dynamics: 'pendulum',
        context: 'Лёгкий → тяжёлый → поддерживающая → разгрузочная. Удар и восстановление.',
        weeks: [
          { weekNumber: 1, level: 'shock_low' },
          { weekNumber: 2, level: 'shock_high' },
          { weekNumber: 3, level: 'shock_support' },
          { weekNumber: 4, level: 'shock_unload' },
        ],
      },
    ],
  }
}

/**
 * Шаблоны предсоревновательного мезоцикла.
 *
 * Предсоревновательный мезоцикл — подведение к старту.
 * Ключевая особенность: убывающая нагрузка. Последняя неделя — самая лёгкая.
 * Допускается начало с базовой или подводящей нагрузки.
 *
 * Уровни нагрузки:
 *   taper_start  → base            (PC1 ≈ −0.66) — начальная нагрузка
 *   taper_mid    → taper           (PC1 ≈ −1.27) — подводящая
 *   taper_low    → taper/rec_intro (PC1 ≈ −1.58) — лёгкая подводящая
 *   taper_finish → recovery/rec_intro (PC1 ≈ −2.0..−2.5) — финальная разгрузка
 */
function getTaperMesoTemplates() {
  return {
    2: [
      // --- УБЫВАЮЩАЯ (основная для предсоревновательного) ---
      {
        variantId: 'v1',
        name: 'Классическая подводка',
        dynamics: 'descending',
        context: 'Подводящая → разгрузочная. Стандартное подведение к старту.',
        weeks: [
          { weekNumber: 1, level: 'taper_mid' },
          { weekNumber: 2, level: 'taper_finish' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Быстрая подводка',
        dynamics: 'descending',
        context: 'Базовая → подводящая. Короткое подведение для подготовленных.',
        weeks: [
          { weekNumber: 1, level: 'taper_start' },
          { weekNumber: 2, level: 'taper_mid' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Глубокая разгрузка',
        dynamics: 'descending',
        context: 'Базовая → финальная разгрузка. Максимальное восстановление к старту.',
        weeks: [
          { weekNumber: 1, level: 'taper_start' },
          { weekNumber: 2, level: 'taper_finish' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v4',
        name: 'Равномерная подводка',
        dynamics: 'step',
        context: 'Две подводящие недели. Стабильно низкая нагрузка перед стартом.',
        weeks: [
          { weekNumber: 1, level: 'taper_mid' },
          { weekNumber: 2, level: 'taper_mid' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Равномерная лёгкая',
        dynamics: 'step',
        context: 'Две лёгких подводящих. Длительное восстановление перед стартом.',
        weeks: [
          { weekNumber: 1, level: 'taper_low' },
          { weekNumber: 2, level: 'taper_low' },
        ],
      },
    ],

    3: [
      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Линейная подводка',
        dynamics: 'descending',
        context: 'Базовая → подводящая → разгрузочная. Линейное снижение к старту.',
        weeks: [
          { weekNumber: 1, level: 'taper_start' },
          { weekNumber: 2, level: 'taper_mid' },
          { weekNumber: 3, level: 'taper_finish' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Подводка с напоминанием',
        dynamics: 'pendulum',
        context: 'Подводящая → базовая → разгрузочная. Нагрузочное напоминание перед разгрузкой.',
        weeks: [
          { weekNumber: 1, level: 'taper_low' },
          { weekNumber: 2, level: 'taper_start' },
          { weekNumber: 3, level: 'taper_finish' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Ступенчатая подводка',
        dynamics: 'step',
        context: 'Две базовых → одна разгрузочная. Ступенчатое снижение.',
        weeks: [
          { weekNumber: 1, level: 'taper_start' },
          { weekNumber: 2, level: 'taper_start' },
          { weekNumber: 3, level: 'taper_finish' },
        ],
      },

      // --- УБЫВАЮЩАЯ ПЛАВНАЯ ---
      {
        variantId: 'v4',
        name: 'Плавная подводка',
        dynamics: 'descending',
        context: 'Подводящая → лёгкая подводящая → разгрузочная. Мягкое снижение.',
        weeks: [
          { weekNumber: 1, level: 'taper_mid' },
          { weekNumber: 2, level: 'taper_low' },
          { weekNumber: 3, level: 'taper_finish' },
        ],
      },

      // --- НАРАСТАЮЩАЯ (от лёгкого к базовому — «разгон к старту») ---
      {
        variantId: 'v5',
        name: 'Подводка с выходом на пик',
        dynamics: 'ascending',
        context: 'Разгрузочная → лёгкая → подводящая. Нарастание к пику формы.',
        weeks: [
          { weekNumber: 1, level: 'taper_finish' },
          { weekNumber: 2, level: 'taper_low' },
          { weekNumber: 3, level: 'taper_mid' },
        ],
      },
    ],

    4: [
      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Длинная линейная подводка',
        dynamics: 'descending',
        context: 'Базовая → подводящая → лёгкая → разгрузочная. Четыре ступени снижения.',
        weeks: [
          { weekNumber: 1, level: 'taper_start' },
          { weekNumber: 2, level: 'taper_mid' },
          { weekNumber: 3, level: 'taper_low' },
          { weekNumber: 4, level: 'taper_finish' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Волнообразная подводка',
        dynamics: 'pendulum',
        context: 'Подводящая → базовая → подводящая → разгрузочная. Волна перед стартом.',
        weeks: [
          { weekNumber: 1, level: 'taper_mid' },
          { weekNumber: 2, level: 'taper_start' },
          { weekNumber: 3, level: 'taper_low' },
          { weekNumber: 4, level: 'taper_finish' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Двухступенчатая подводка',
        dynamics: 'step',
        context: 'Блок базовых → блок разгрузочных. Две ступени снижения.',
        weeks: [
          { weekNumber: 1, level: 'taper_start' },
          { weekNumber: 2, level: 'taper_start' },
          { weekNumber: 3, level: 'taper_low' },
          { weekNumber: 4, level: 'taper_finish' },
        ],
      },

      // --- УБЫВАЮЩАЯ ГЛУБОКАЯ ---
      {
        variantId: 'v4',
        name: 'Глубокая подводка',
        dynamics: 'descending',
        context:
          'Подводящая → лёгкая → лёгкая подводящая → разгрузочная. Максимальное восстановление.',
        weeks: [
          { weekNumber: 1, level: 'taper_mid' },
          { weekNumber: 2, level: 'taper_low' },
          { weekNumber: 3, level: 'taper_low' },
          { weekNumber: 4, level: 'taper_finish' },
        ],
      },

      // --- НАРАСТАЮЩАЯ К ПИКУ ---
      {
        variantId: 'v5',
        name: 'Подводка с финальным пиком',
        dynamics: 'ascending',
        context: 'Разгрузочная → лёгкая → подводящая → базовая. Выход на пик к старту.',
        weeks: [
          { weekNumber: 1, level: 'taper_finish' },
          { weekNumber: 2, level: 'taper_low' },
          { weekNumber: 3, level: 'taper_mid' },
          { weekNumber: 4, level: 'taper_start' },
        ],
      },
    ],
  }
}

/**
 * Шаблоны восстановительного (разгрузочного) мезоцикла.
 *
 * Восстановительный мезоцикл — блок глубокого восстановления.
 * Применяется после развивающего блока, после соревнований,
 * при перетренировке, травмах, в межсезонье.
 * Преобладают Зоны 1+2, Зоны 3+4 исключены.
 *
 * Уровни нагрузки:
 *   rec_deep   → recovery            (PC1 ≈ −2.50)  — глубокий отдых
 *   rec_mid    → recovery            (PC1 ≈ −2.0)   — средний отдых
 *   rec_light  → recovery/rec_intro  (PC1 ≈ −1.58)  — лёгкое восстановление
 *   rec_exit   → recovery_intro      (PC1 ≈ −1.27)  — выход из разгрузки
 */
function getRecoveryMesoTemplates() {
  return {
    2: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Восстановление с выходом',
        dynamics: 'ascending',
        context: 'Глубокий отдых → лёгкое восстановление. Стандартный выход из разгрузки.',
        weeks: [
          { weekNumber: 1, level: 'rec_deep' },
          { weekNumber: 2, level: 'rec_light' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Быстрый выход',
        dynamics: 'ascending',
        context: 'Средний отдых → выход. Короткая разгрузка для подготовленных.',
        weeks: [
          { weekNumber: 1, level: 'rec_mid' },
          { weekNumber: 2, level: 'rec_exit' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v3',
        name: 'Погружение в отдых',
        dynamics: 'descending',
        context: 'Средний отдых → глубокий. Нарастающее восстановление.',
        weeks: [
          { weekNumber: 1, level: 'rec_light' },
          { weekNumber: 2, level: 'rec_deep' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v4',
        name: 'Равномерный глубокий',
        dynamics: 'step',
        context: 'Два глубоких восстановительных микроцикла. Максимальный отдых.',
        weeks: [
          { weekNumber: 1, level: 'rec_deep' },
          { weekNumber: 2, level: 'rec_deep' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Равномерный средний',
        dynamics: 'step',
        context: 'Два средних восстановительных. Умеренная разгрузка.',
        weeks: [
          { weekNumber: 1, level: 'rec_mid' },
          { weekNumber: 2, level: 'rec_mid' },
        ],
      },
    ],

    3: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Линейный выход из разгрузки',
        dynamics: 'ascending',
        context: 'Глубокий → средний → лёгкий. Плавный возврат к работе.',
        weeks: [
          { weekNumber: 1, level: 'rec_deep' },
          { weekNumber: 2, level: 'rec_mid' },
          { weekNumber: 3, level: 'rec_exit' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Маятниковое восстановление',
        dynamics: 'pendulum',
        context: 'Лёгкий → глубокий → выход. Активация перед глубоким отдыхом.',
        weeks: [
          { weekNumber: 1, level: 'rec_light' },
          { weekNumber: 2, level: 'rec_deep' },
          { weekNumber: 3, level: 'rec_exit' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Ступенчатый выход',
        dynamics: 'step',
        context: 'Два глубоких (плато) → один лёгкий (ступень вверх).',
        weeks: [
          { weekNumber: 1, level: 'rec_deep' },
          { weekNumber: 2, level: 'rec_deep' },
          { weekNumber: 3, level: 'rec_exit' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v4',
        name: 'Погружение в глубокий отдых',
        dynamics: 'descending',
        context: 'Лёгкий → средний → глубокий. Нарастающая разгрузка.',
        weeks: [
          { weekNumber: 1, level: 'rec_exit' },
          { weekNumber: 2, level: 'rec_mid' },
          { weekNumber: 3, level: 'rec_deep' },
        ],
      },

      // --- НАРАСТАЮЩАЯ С ВЫХОДОМ ---
      {
        variantId: 'v5',
        name: 'Глубокий отдых с выходом',
        dynamics: 'ascending',
        context: 'Глубокий → лёгкий → выход. Быстрый подъём после глубокой разгрузки.',
        weeks: [
          { weekNumber: 1, level: 'rec_deep' },
          { weekNumber: 2, level: 'rec_light' },
          { weekNumber: 3, level: 'rec_exit' },
        ],
      },
    ],

    4: [
      // --- НАРАСТАЮЩАЯ ---
      {
        variantId: 'v1',
        name: 'Длинный выход из разгрузки',
        dynamics: 'ascending',
        context: 'Глубокий → глубокий → средний → выход. Четыре ступени подъёма.',
        weeks: [
          { weekNumber: 1, level: 'rec_deep' },
          { weekNumber: 2, level: 'rec_mid' },
          { weekNumber: 3, level: 'rec_light' },
          { weekNumber: 4, level: 'rec_exit' },
        ],
      },

      // --- МАЯТНИКОВАЯ ---
      {
        variantId: 'v2',
        name: 'Волнообразное восстановление',
        dynamics: 'pendulum',
        context: 'Средний → глубокий → лёгкий → средний. Волна восстановления.',
        weeks: [
          { weekNumber: 1, level: 'rec_light' },
          { weekNumber: 2, level: 'rec_deep' },
          { weekNumber: 3, level: 'rec_exit' },
          { weekNumber: 4, level: 'rec_mid' },
        ],
      },

      // --- СТУПЕНЧАТАЯ ---
      {
        variantId: 'v3',
        name: 'Двухступенчатое восстановление',
        dynamics: 'step',
        context: 'Блок глубоких → блок лёгких. Ступенчатый подъём.',
        weeks: [
          { weekNumber: 1, level: 'rec_deep' },
          { weekNumber: 2, level: 'rec_deep' },
          { weekNumber: 3, level: 'rec_light' },
          { weekNumber: 4, level: 'rec_exit' },
        ],
      },

      // --- УБЫВАЮЩАЯ ---
      {
        variantId: 'v4',
        name: 'Длинное погружение',
        dynamics: 'descending',
        context: 'Выход → лёгкий → средний → глубокий. Нарастающая разгрузка при перетренировке.',
        weeks: [
          { weekNumber: 1, level: 'rec_exit' },
          { weekNumber: 2, level: 'rec_light' },
          { weekNumber: 3, level: 'rec_mid' },
          { weekNumber: 4, level: 'rec_deep' },
        ],
      },

      // --- ГЛУБОКИЙ С ВЫХОДОМ ---
      {
        variantId: 'v5',
        name: 'Глубокий блок с выходом',
        dynamics: 'ascending',
        context: 'Три глубоких → один лёгкий. Максимальное восстановление с выходом.',
        weeks: [
          { weekNumber: 1, level: 'rec_deep' },
          { weekNumber: 2, level: 'rec_deep' },
          { weekNumber: 3, level: 'rec_mid' },
          { weekNumber: 4, level: 'rec_exit' },
        ],
      },
    ],
  }
}

// =============== УНИВЕРСАЛЬНЫЙ БИЛДЕР ====================

/**
 * Материализовать один шаблон мезоцикла.
 * Адаптивно подбирает микроциклы по уровням нагрузки.
 */
function materializeMesoTemplate(template, microCatalogs, sessionsPerWeek, type) {
  const weeks = []
  const usedKeys = new Set()

  for (const weekDef of template.weeks) {
    const result = selectMicroForLevel(microCatalogs, weekDef.level, sessionsPerWeek, usedKeys)

    if (!result) {
      console.warn(
        `Нет подходящего микроцикла: level=${weekDef.level}, ` +
          `sessions=${sessionsPerWeek}, template=${template.variantId}`
      )
      return null
    }

    usedKeys.add(result.key)

    weeks.push({
      weekNumber: weekDef.weekNumber,
      level: weekDef.level,
      selectedKey: result.key,
      microCycle: result.micro,
    })
  }

  const metadata = computeMesoMetadata(weeks)

  return {
    variantId: template.variantId,
    name: template.name,
    context: template.context,
    type,
    dynamics: template.dynamics,
    sessionsPerWeek,
    weeks,
    metadata,
  }
}

/**
 * Построить все варианты мезоцикла заданного типа.
 */
function buildMesoCycle(athleteData, type, sessionsPerWeek) {
  const mesoTemplates = getMesoTemplates(type)

  // Собираем нужные типы микроциклов из LOAD_LEVELS
  const neededMicroTypes = new Set()
  for (const level of Object.values(LOAD_LEVELS)) {
    for (const t of level.types) neededMicroTypes.add(t)
  }

  const microCatalogs = {}
  for (const microType of neededMicroTypes) {
    microCatalogs[microType] = createCatalog(athleteData, microType)
  }

  const result = {}
  for (const [length, templates] of Object.entries(mesoTemplates)) {
    result[length] = templates
      .map((tpl) => materializeMesoTemplate(tpl, microCatalogs, sessionsPerWeek, type))
      .filter(Boolean)
  }

  return result
}

// ==================== ВАЛИДАТОРЫ =========================

function getMesoValidator(type) {
  switch (type) {
    case 'recovery_intro':
      return validateRecoveryIntroMeso
    case 'base':
      return validateBaseMeso
    case 'shock':
      return validateShockMeso
    case 'taper':
      return validateTaperMeso
    case 'recovery':
      return validateRecoveryMeso
    default:
      throw new Error(`Нет валидатора для мезоцикла: ${type}`)
  }
}

/**
 * Валидация динамики мезоцикла.
 */
function validateDynamics(weeklyPC1, expectedDynamics) {
  const n = weeklyPC1.length
  if (n < 2) return { valid: true, actual: expectedDynamics }

  const deltas = []
  for (let i = 1; i < n; i++) {
    deltas.push(weeklyPC1[i] - weeklyPC1[i - 1])
  }

  const allUp = deltas.every((d) => d >= 0)
  const allDown = deltas.every((d) => d <= 0)
  const hasSignChange =
    deltas.length >= 2 &&
    deltas.some(
      (d, i) =>
        i > 0 &&
        Math.sign(d) !== 0 &&
        Math.sign(deltas[i - 1]) !== 0 &&
        Math.sign(d) !== Math.sign(deltas[i - 1])
    )

  let actual
  if (allUp) actual = 'ascending'
  else if (allDown) actual = 'descending'
  else if (hasSignChange) actual = 'pendulum'
  else actual = 'step'

  const valid =
    actual === expectedDynamics ||
    (expectedDynamics === 'step' &&
      (actual === 'ascending' || actual === 'descending' || actual === 'step'))

  return { valid, actual }
}

/**
 * Критерии втягивающего мезоцикла:
 * (а) динамика соответствует заявленной
 * (б) средний PC1 < −0.5
 * (в) нет avoid-сессий
 * (г) Зоны 3+4 ≤ 10%
 */
function validateRecoveryIntroMeso(mesoVariant) {
  const { metadata, dynamics } = mesoVariant
  const warnings = []

  const dynCheck = validateDynamics(metadata.weeklyPC1, dynamics)
  if (!dynCheck.valid) {
    warnings.push(`Динамика: ожидалось ${dynamics}, факт ${dynCheck.actual}`)
  }

  const pc1Check = metadata.averagePC1 < -0.5
  if (!pc1Check) {
    warnings.push(`Средний PC1 мезоцикла = ${metadata.averagePC1} (нужен < −0.5)`)
  }

  const noAvoid = metadata.totalRealismProfile.avoid === 0
  if (!noAvoid) {
    warnings.push(`avoid-сессий: ${metadata.totalRealismProfile.avoid}`)
  }

  const highZones = (metadata.totalDistribution[3] || 0) + (metadata.totalDistribution[4] || 0)
  const highRatio = highZones / metadata.totalSessions
  const highCheck = highRatio <= 0.1
  if (!highCheck) {
    warnings.push(`Зоны 3+4 = ${(highRatio * 100).toFixed(0)}% (≤10%)`)
  }

  return {
    valid: dynCheck.valid && pc1Check && noAvoid && highCheck,
    checks: {
      dynamicsValid: dynCheck.valid,
      dynamicsExpected: dynamics,
      dynamicsActual: dynCheck.actual,
      pc1Check,
      noAvoid,
      highCheck,
      highZonesRatio: Math.round(highRatio * 100),
    },
    warnings,
  }
}

/**
 * Критерии базового мезоцикла:
 * (а) динамика соответствует заявленной
 * (б) средний PC1 ∈ [−1.0; +0.5]
 * (в) нет avoid-сессий
 * (г) Z2 ≥ 40% от всех сессий
 * (д) ≤ 1 ударная неделя (shock-микроцикл)
 */
function validateBaseMeso(mesoVariant) {
  const { metadata, dynamics, weeks } = mesoVariant
  const warnings = []

  // (а) Динамика
  const dynCheck = validateDynamics(metadata.weeklyPC1, dynamics)
  if (!dynCheck.valid) {
    warnings.push(`Динамика: ожидалось ${dynamics}, факт ${dynCheck.actual}`)
  }

  // (б) Средний PC1 ∈ [−1.0; +0.5]
  const pc1Check = metadata.averagePC1 >= -1.0 && metadata.averagePC1 <= 0.5
  if (!pc1Check) {
    warnings.push(`Средний PC1 = ${metadata.averagePC1} (нужен [−1.0; +0.5])`)
  }

  // (в) Нет avoid
  const noAvoid = metadata.totalRealismProfile.avoid === 0
  if (!noAvoid) {
    warnings.push(`avoid-сессий: ${metadata.totalRealismProfile.avoid}`)
  }

  // (г) Z2 ≥ 40%
  const z2Ratio = (metadata.totalDistribution[2] || 0) / metadata.totalSessions
  const z2Check = z2Ratio >= 0.4
  if (!z2Check) {
    warnings.push(`Z2 = ${(z2Ratio * 100).toFixed(0)}% (≥40%)`)
  }

  // (д) ≤ 1 ударная неделя
  const shockWeeks = weeks.filter((w) => w.selectedKey && w.selectedKey.startsWith('shock/')).length
  const shockCheck = shockWeeks <= 1
  if (!shockCheck) {
    warnings.push(`Ударных недель: ${shockWeeks} (≤1)`)
  }

  return {
    valid: dynCheck.valid && pc1Check && noAvoid && z2Check && shockCheck,
    checks: {
      dynamicsValid: dynCheck.valid,
      dynamicsExpected: dynamics,
      dynamicsActual: dynCheck.actual,
      pc1Check,
      noAvoid,
      z2Check,
      z2Ratio: Math.round(z2Ratio * 100),
      shockCheck,
      shockWeeks,
    },
    warnings,
  }
}

/**
 * Критерии развивающего мезоцикла:
 * (а) динамика соответствует заявленной
 * (б) средний PC1 ≥ −0.7 (мезоцикл смещён к высоким зонам)
 * (в) нет avoid-сессий
 * (г) Зоны 3+4 ≥ 15% от всех сессий (минимум развивающего стресса)
 * (д) ≥ 1 ударная неделя (shock-микроцикл)
 */
function validateShockMeso(mesoVariant) {
  const { metadata, dynamics, weeks } = mesoVariant
  const warnings = []

  // (а) Динамика
  const dynCheck = validateDynamics(metadata.weeklyPC1, dynamics)
  if (!dynCheck.valid) {
    warnings.push(`Динамика: ожидалось ${dynamics}, факт ${dynCheck.actual}`)
  }

  // (б) Средний PC1 ≥ −0.75
  const pc1Check = metadata.averagePC1 >= -0.75
  if (!pc1Check) {
    warnings.push(`Средний PC1 = ${metadata.averagePC1} (нужен ≥ −0.75)`)
  }

  // (в) Нет avoid
  const noAvoid = metadata.totalRealismProfile.avoid === 0
  if (!noAvoid) {
    warnings.push(`avoid-сессий: ${metadata.totalRealismProfile.avoid}`)
  }

  // (г) Z3+Z4 ≥ 15%
  const highZones = (metadata.totalDistribution[3] || 0) + (metadata.totalDistribution[4] || 0)
  const highRatio = highZones / metadata.totalSessions
  const highCheck = highRatio >= 0.15
  if (!highCheck) {
    warnings.push(`Зоны 3+4 = ${(highRatio * 100).toFixed(0)}% (≥15%)`)
  }

  // (д) ≥ 1 ударная неделя
  const shockWeeks = weeks.filter((w) => w.selectedKey && w.selectedKey.startsWith('shock/')).length
  const shockCheck = shockWeeks >= 1
  if (!shockCheck) {
    warnings.push(`Ударных недель: ${shockWeeks} (≥1)`)
  }

  return {
    valid: dynCheck.valid && pc1Check && noAvoid && highCheck && shockCheck,
    checks: {
      dynamicsValid: dynCheck.valid,
      dynamicsExpected: dynamics,
      dynamicsActual: dynCheck.actual,
      pc1Check,
      noAvoid,
      highCheck,
      highZonesRatio: Math.round(highRatio * 100),
      shockCheck,
      shockWeeks,
    },
    warnings,
  }
}

/**
 * Критерии предсоревновательного мезоцикла:
 * (а) динамика соответствует заявленной
 * (б) средний PC1 < −0.5 (мезоцикл в зоне сниженной нагрузки)
 * (в) нет avoid-сессий
 * (г) Зоны 3+4 ≤ 15% (допускается подводящая работа, но ограниченно)
 * (д) Z1 ≥ 20% (обязательна восстановительная компонента)
 */
function validateTaperMeso(mesoVariant) {
  const { metadata, dynamics } = mesoVariant
  const warnings = []

  // (а) Динамика
  const dynCheck = validateDynamics(metadata.weeklyPC1, dynamics)
  if (!dynCheck.valid) {
    warnings.push(`Динамика: ожидалось ${dynamics}, факт ${dynCheck.actual}`)
  }

  // (б) Средний PC1 < −0.5
  const pc1Check = metadata.averagePC1 < -0.5
  if (!pc1Check) {
    warnings.push(`Средний PC1 = ${metadata.averagePC1} (нужен < −0.5)`)
  }

  // (в) Нет avoid
  const noAvoid = metadata.totalRealismProfile.avoid === 0
  if (!noAvoid) {
    warnings.push(`avoid-сессий: ${metadata.totalRealismProfile.avoid}`)
  }

  // (г) Z3+Z4 ≤ 15%
  const highZones = (metadata.totalDistribution[3] || 0) + (metadata.totalDistribution[4] || 0)
  const highRatio = highZones / metadata.totalSessions
  const highCheck = highRatio <= 0.15
  if (!highCheck) {
    warnings.push(`Зоны 3+4 = ${(highRatio * 100).toFixed(0)}% (≤15%)`)
  }

  // (д) Z1 ≥ 15%
  const z1Ratio = (metadata.totalDistribution[1] || 0) / metadata.totalSessions
  const z1Check = z1Ratio >= 0.15
  if (!z1Check) {
    warnings.push(`Z1 = ${(z1Ratio * 100).toFixed(0)}% (≥15%)`)
  }

  return {
    valid: dynCheck.valid && pc1Check && noAvoid && highCheck && z1Check,
    checks: {
      dynamicsValid: dynCheck.valid,
      dynamicsExpected: dynamics,
      dynamicsActual: dynCheck.actual,
      pc1Check,
      noAvoid,
      highCheck,
      highZonesRatio: Math.round(highRatio * 100),
      z1Check,
      z1Ratio: Math.round(z1Ratio * 100),
    },
    warnings,
  }
}

/**
 * Критерии восстановительного мезоцикла:
 * (а) динамика соответствует заявленной
 * (б) средний PC1 < −1.0 (мезоцикл в зоне глубокого восстановления)
 * (в) нет avoid-сессий
 * (г) Зоны 3+4 = 0 (никакой развивающей нагрузки)
 * (д) Z1 ≥ 40% (преобладание восстановительной работы)
 */
function validateRecoveryMeso(mesoVariant) {
  const { metadata, dynamics } = mesoVariant
  const warnings = []

  const dynCheck = validateDynamics(metadata.weeklyPC1, dynamics)
  if (!dynCheck.valid) {
    warnings.push(`Динамика: ожидалось ${dynamics}, факт ${dynCheck.actual}`)
  }

  const pc1Check = metadata.averagePC1 < -1.0
  if (!pc1Check) {
    warnings.push(`Средний PC1 = ${metadata.averagePC1} (нужен < −1.0)`)
  }

  const noAvoid = metadata.totalRealismProfile.avoid === 0
  if (!noAvoid) {
    warnings.push(`avoid-сессий: ${metadata.totalRealismProfile.avoid}`)
  }

  const highZones = (metadata.totalDistribution[3] || 0) + (metadata.totalDistribution[4] || 0)
  const highCheck = highZones === 0
  if (!highCheck) {
    warnings.push(`Зоны 3+4 = ${highZones} (нужно 0)`)
  }

  const z1Ratio = (metadata.totalDistribution[1] || 0) / metadata.totalSessions
  const z1Check = z1Ratio >= 0.4
  if (!z1Check) {
    warnings.push(`Z1 = ${(z1Ratio * 100).toFixed(0)}% (≥40%)`)
  }

  return {
    valid: dynCheck.valid && pc1Check && noAvoid && highCheck && z1Check,
    checks: {
      dynamicsValid: dynCheck.valid,
      dynamicsExpected: dynamics,
      dynamicsActual: dynCheck.actual,
      pc1Check,
      noAvoid,
      highCheck,
      highZones,
      z1Check,
      z1Ratio: Math.round(z1Ratio * 100),
    },
    warnings,
  }
}

// ================ ТОЧКИ ВХОДА (PUBLIC API) ================

/**
 * Создать каталог мезоциклов для одного спортсмена.
 *
 * @param {Object} athleteData     - элемент из allAthletePlans
 * @param {string} type            - тип мезоцикла ('recovery_intro')
 * @param {number} sessionsPerWeek - тренировок в неделю (3-6)
 * @returns {Object} { "2": [...], "3": [...], "4": [...] }
 */
export function createMesoCatalog(athleteData, type, sessionsPerWeek) {
  const raw = buildMesoCycle(athleteData, type, sessionsPerWeek)
  const validate = getMesoValidator(type)
  const result = {}

  for (const [length, variants] of Object.entries(raw)) {
    result[length] = variants.map((variant) => ({
      ...variant,
      validation: validate(variant),
    }))
  }

  return result
}

/**
 * Создать каталог мезоциклов для всех спортсменов.
 *
 * @param {Array} allAthletePlans  - массив из allAthletePlans
 * @param {string} type            - тип мезоцикла
 * @param {number} sessionsPerWeek - тренировок в неделю (3-6)
 * @returns {Array<{ athleteId, name, catalog }>}
 */
export function createMesoCatalogForAll(allAthletePlans, type, sessionsPerWeek) {
  return allAthletePlans.map((athlete) => ({
    athleteId: athlete.athleteId,
    name: athlete.name,
    catalog: createMesoCatalog(athlete, type, sessionsPerWeek),
  }))
}

// module.exports = {
//   createMesoCatalog,
//   createMesoCatalogForAll,
// }
