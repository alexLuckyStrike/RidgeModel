// ============================================================
// createMicroCycle.js
// Единый модуль построения микроциклов
// Один файл, один импорт
// ============================================================

// ======================== КОНСТАНТЫ ========================

const ALLOWED_REALISM = new Set(['good', 'caution'])

// ======================== ХЕЛПЕРЫ ==========================

function lookupVariant(athletePlan, strategyId, targetZone) {
  const strategy = athletePlan.strategies.find((s) => s.id === strategyId)
  if (!strategy) return null
  return strategy.variants.find((v) => v.targetZone === targetZone) || null
}

function isAllowedRealism(variant) {
  if (!variant || !variant.realism) return false
  return ALLOWED_REALISM.has(variant.realism.status)
}

function buildSession(sessionIndex, zone, strategyId, variant) {
  return {
    sessionIndex,
    zone,
    strategy: strategyId,
    predictedPC1: variant.predictedPC1,
    realism: variant.realism.status,
    deltas: variant.deltas,
    description: variant.description,
  }
}

function assignRanks(arr) {
  const n = arr.length
  const indexed = arr.map((v, i) => ({ value: v, index: i }))
  indexed.sort((a, b) => a.value - b.value)

  const ranks = new Array(n)
  let i = 0
  while (i < n) {
    let j = i
    while (j < n - 1 && indexed[j + 1].value === indexed[j].value) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[indexed[k].index] = avgRank
    i = j + 1
  }
  return ranks
}

function computeSpearman(x, y) {
  const n = x.length
  if (n < 3) return 0

  const rankX = assignRanks(x)
  const rankY = assignRanks(y)

  let sumD2 = 0
  for (let i = 0; i < n; i++) {
    const d = rankX[i] - rankY[i]
    sumD2 += d * d
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1))
}

function computeMetadata(sessions) {
  const n = sessions.length

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0 }
  sessions.forEach((s) => distribution[s.zone]++)

  const averagePC1 = sessions.reduce((sum, s) => sum + s.predictedPC1, 0) / n

  const realismProfile = { good: 0, caution: 0, avoid: 0 }
  sessions.forEach((s) => realismProfile[s.realism]++)

  const strategyCounts = {}
  sessions.forEach((s) => {
    strategyCounts[s.strategy] = (strategyCounts[s.strategy] || 0) + 1
  })
  const dominantStrategy = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])[0][0]

  const spearman = computeSpearman(
    sessions.map((s) => s.sessionIndex),
    sessions.map((s) => s.zone)
  )

  return {
    distribution,
    averagePC1: Math.round(averagePC1 * 100) / 100,
    spearman: Math.round(spearman * 100) / 100,
    realismProfile,
    dominantStrategy,
    firstZone: sessions[0].zone,
    lastZone: sessions[n - 1].zone,
  }
}

// ======================== ШАБЛОНЫ ==========================

function getTemplates(type) {
  switch (type) {
    case 'recovery_intro':
      return getRecoveryIntroTemplates()
    case 'base':
      return getBaseTemplates()
    case 'shock':
      return getShockTemplates()
    case 'taper':
      return getTaperTemplates()
    case 'recovery':
      return getRecoveryTemplates()
    default:
      throw new Error(`Неизвестный тип микроцикла: ${type}`)
  }
}

function getRecoveryIntroTemplates() {
  return {
    3: [
      {
        variantId: 'v1',
        name: 'Мягкий вход',
        context: 'Возврат после короткого перерыва (1–2 недели). Минимальная нагрузка.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Техническая разминка',
        context: 'Акцент на технику в соревновательных движениях при сниженной нагрузке.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Равномерный низкий',
        context: 'Все сессии в Зоне 1. Максимальное восстановление, нулевой стресс.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Нарастающий разгон',
        context: 'Линейный рост от Зоны 1 к Зоне 2. Подготовка к базовому микроциклу.',
        sessions: [
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Осторожный объёмный',
        context: 'Одна caution-сессия (volume_only Зоны 1) для акцента на объём при сниженном V.',
        sessions: [
          { zone: 1, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
    ],
    4: [
      {
        variantId: 'v1',
        name: 'Классический после отпуска',
        context: 'Стандартный втягивающий после 2–4 недель отдыха. Чередование Зон 1 и 2.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Линейный разгон',
        context: 'Строго нарастающая динамика: два дня Зоны 1, два дня Зоны 2.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Вариативный восстановительный',
        context: 'Доминирование variative-стратегии. Мягкая мультипараметрическая регулировка.',
        sessions: [
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Объёмный акцент',
        context: 'Зона 2 через volume_only — технический объём при плановой интенсивности.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Интенсивный акцент',
        context: 'Зона 2 через pace_only — работа с привычным объёмом, сниженная интенсивность.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
    ],
    5: [
      {
        variantId: 'v1',
        name: 'Расширенный после межсезонья',
        context: 'Длительная пауза (4+ недель). Плавный разгон на 5 дней.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Волнообразный мягкий',
        context: 'Лёгкая волна: Зона 1 → 2 → 1 → 2 → 2. Плавный переход к базовому.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Равномерный восстановительный',
        context: 'Все сессии максимально лёгкие. Зона 1 доминирует (80%).',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'После травмы (осторожный)',
        context: 'Возврат после лёгкой травмы. Без pace_only, только balanced + variative.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Нарастающий с объёмной адаптацией',
        context: 'Первые 2 сессии Зоны 1, затем 3 сессии Зоны 2 с разными стратегиями.',
        sessions: [
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
    ],
    6: [
      {
        variantId: 'v1',
        name: 'Полноразгонный после длительного перерыва',
        context: 'Межсезонье 6+ недель. Максимально постепенный разгон.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Высокочастотный лёгкий',
        context: '6 коротких сессий. Адаптация ОДА к частоте тренировок.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Доминирование Зоны 1',
        context: 'Глубокое восстановление после хронической перегрузки. 4 из 6 в Зоне 1.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Прогрессивный с объёмным финалом',
        context: 'Линейный рост к Зоне 2 в конце. Мостик к базовому микроциклу.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Смешанный адаптационный',
        context: 'Разнообразие стратегий для адаптации к разным режимам работы.',
        sessions: [
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
    ],
  }
}

function getBaseTemplates() {
  return {
    3: [
      {
        variantId: 'v1',
        name: 'Объёмный базовый',
        context: 'Три сессии в Зоне 2 через volume_only. Стабильный объёмный блок.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Базовый с развивающей',
        context: 'Одна развивающая сессия Зоны 3 + две в Зоне 2. Классический минимум.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Интенсивный базовый',
        context: 'Акцент на pace_only в Зоне 2. Нейральная адаптация.',
        sessions: [
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'pace_only' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Вариативный базовый',
        context: 'Все сессии Зоны 2 через variative. Мультипараметрическая работа.',
        sessions: [
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Базовый с развивающей интенсивной',
        context: 'Развивающая Зона 3 через pace_only + две рабочие Зоны 2.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'pace_only' },
          { zone: 2, strategy: 'variative' },
        ],
      },
    ],
    4: [
      {
        variantId: 'v1',
        name: 'Волновой Шейко-стиль',
        context: 'Тяжёлая → лёгкая → средняя → средняя. Классика Шейко.',
        sessions: [
          { zone: 3, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Равномерный объёмный',
        context: 'Четыре сессии Зоны 2. Устойчивая базовая нагрузка.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Интенсивный conjugate-стиль',
        context: 'Акцент на pace_only. Нейральная адаптация через интенсивность.',
        sessions: [
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Нарастающий к развивающей',
        context: 'Линейный рост: Зона 2 → Зона 2 → Зона 2 → Зона 3 в конце.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Волновой с компенсацией',
        context: 'Развивающая + компенсаторная + две рабочие. Полноценная волна.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
    ],
    5: [
      {
        variantId: 'v1',
        name: 'DUP-стиль',
        context: 'Чередование объёмных и интенсивных сессий внутри недели.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'pace_only' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Волновой с пиком в середине',
        context: 'Развивающая в середине недели, компенсация после неё.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Равномерный длинный',
        context: 'Пять сессий Зоны 2. Стабильная работа для долгих базовых блоков.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Объёмный с recovery_only',
        context: 'Четыре volume_only + одна recovery_only Зоны 2 для разнообразия.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'recovery_only' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Нарастающий с пиком в конце',
        context: 'Постепенный рост к развивающей сессии в конце недели.',
        sessions: [
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
    ],
    6: [
      {
        variantId: 'v1',
        name: 'Высокочастотный Bulgarian-light',
        context: 'Шесть сессий Зоны 2. Адаптация к высокой частоте тренировок.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Волновой двухпиковый',
        context: 'Два подъёма нагрузки с лёгким средним днём.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'recovery_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v3',
        name: 'С развивающей и компенсацией',
        context: 'Развивающая Зона 3 в начале + компенсация + четыре рабочих.',
        sessions: [
          { zone: 3, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v4',
        name: 'DUP расширенный',
        context: 'Шесть сессий с чередованием volume_only и pace_only.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Прогрессивный к развивающей',
        context: 'Пять рабочих Зоны 2 + развивающая Зона 3 в конце.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 3, strategy: 'volume_only' },
        ],
      },
    ],
  }
}

function getShockTemplates() {
  return {
    3: [
      {
        variantId: 'v1',
        name: 'Объёмный шок минимальный',
        context: 'Минимальный ударный: Зона 3 + Зона 4 + компенсация Зоной 1.',
        sessions: [
          { zone: 4, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Сбалансированный шок',
        context: 'Ударная через balanced + компенсация + развивающая.',
        sessions: [
          { zone: 4, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Интенсивный шок',
        context: 'Ударная через pace_only Зоны 4 (caution). Conjugate-стиль.',
        sessions: [
          { zone: 4, strategy: 'pace_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'pace_only' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Вариативный шок',
        context: 'Ударная через variative. Мультипараметрический стимул.',
        sessions: [
          { zone: 3, strategy: 'variative' },
          { zone: 4, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Двойная развивающая',
        context: 'Две сессии Зоны 3 + компенсация. Без Зоны 4.',
        sessions: [
          { zone: 3, strategy: 'volume_only' },
          { zone: 1, strategy: 'variative' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
    ],
    4: [
      {
        variantId: 'v1',
        name: 'Объёмный ударный Шейко',
        context: 'Volume shock: Зона 4 + компенсация + две Зоны 3. Школа Шейко.',
        sessions: [
          { zone: 4, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Концентрированный с рабочей',
        context: 'Один пик Зоны 4 + компенсация + две рабочие Зоны 2.',
        sessions: [
          { zone: 4, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Интенсивный ударный conjugate',
        context: 'Intensity shock через pace_only Зоны 4. Метод Симмонса.',
        sessions: [
          { zone: 4, strategy: 'pace_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Волновой ударный',
        context: 'Волна: Зона 2 → Зона 4 → Зона 1 → Зона 3.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 4, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Двухпиковый объёмный',
        context: 'Два пика Зоны 3 с компенсацией между ними.',
        sessions: [
          { zone: 3, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
        ],
      },
    ],
    5: [
      {
        variantId: 'v1',
        name: 'Объёмный шок расширенный',
        context: 'Volume shock + рабочие + компенсация. Классический ударный.',
        sessions: [
          { zone: 4, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Двухпиковый волновой',
        context: 'Два ударных пика (Зоны 4 и 3) с компенсацией между ними.',
        sessions: [
          { zone: 3, strategy: 'balanced' },
          { zone: 4, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Смешанный ударный',
        context: 'Variative в Зонах 3-4. Мультипараметрический стимул.',
        sessions: [
          { zone: 3, strategy: 'variative' },
          { zone: 4, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Интенсивный расширенный',
        context: 'Intensity shock + рабочие. Pace_only в Зонах 3-4.',
        sessions: [
          { zone: 3, strategy: 'pace_only' },
          { zone: 4, strategy: 'pace_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Нарастающий к пику',
        context: 'Линейный рост: Зона 2 → 3 → 3 → 4 → компенсация Зоной 1 в конце.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 3, strategy: 'balanced' },
          { zone: 4, strategy: 'volume_only' },
          { zone: 1, strategy: 'variative' },
        ],
      },
    ],
    6: [
      {
        variantId: 'v1',
        name: 'Концентрированный шок с восстановлением',
        context: 'Один мощный пик + длинное восстановление. Верхошанский-стиль.',
        sessions: [
          { zone: 4, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Двухпиковый с полной компенсацией',
        context: 'Два ударных блока по 2 сессии с компенсацией между ними.',
        sessions: [
          { zone: 3, strategy: 'volume_only' },
          { zone: 4, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 3, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Волновой с тремя подъёмами',
        context: 'Три развивающие сессии через рабочие и компенсаторные.',
        sessions: [
          { zone: 3, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 3, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Объёмный блок Шейко',
        context: 'Четыре сессии Зоны 3 + одна Зона 4 + компенсация. Высокий КПШ.',
        sessions: [
          { zone: 3, strategy: 'volume_only' },
          { zone: 3, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 4, strategy: 'volume_only' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Смешанный расширенный',
        context: 'Разнообразие стратегий в Зонах 3-4. Variative + balanced + volume.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 4, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 3, strategy: 'volume_only' },
          { zone: 3, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
    ],
  }
}

function getTaperTemplates() {
  return {
    3: [
      {
        variantId: 'v1',
        name: 'Экспресс-подводка',
        context: 'Короткая разгрузка перед стартом. Резкое снижение от Зоны 2 к Зоне 1.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Интенсивная подводка',
        context: 'Сохранение интенсивности при сбросе объёма. Pace_only → balanced → лёгкая.',
        sessions: [
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Линейный сброс',
        context: 'Строго убывающая динамика: Зона 3 → 2 → 1.',
        sessions: [
          { zone: 3, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Объёмный сброс',
        context: 'Снижение через volume_only. Объём падает, интенсивность на месте.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Мягкий сброс',
        context: 'Все три сессии — лёгкая работа. Финиш в Зоне 1.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
    ],
    4: [
      {
        variantId: 'v1',
        name: 'Классическая подводка Шейко',
        context: 'Тяжёлая → средняя → лёгкая → лёгкая. Классическая разгрузка.',
        sessions: [
          { zone: 3, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Ступенчатый сброс',
        context: 'Плавные ступени: Зона 2 → 2 → 1 → 1.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'С проходкой (90%)',
        context: 'Проходка в начале (Зона 3) + три дня разгрузки.',
        sessions: [
          { zone: 3, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Сброс через recovery_only',
        context: 'Recovery_only Зоны 2 + ступенчатое снижение к Зоне 1.',
        sessions: [
          { zone: 3, strategy: 'balanced' },
          { zone: 2, strategy: 'recovery_only' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Вариативная подводка',
        context: 'Variative доминирует. Мягкое снижение всех параметров.',
        sessions: [
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
    ],
    5: [
      {
        variantId: 'v1',
        name: 'Расширенная подводка',
        context: 'Пять дней убывающей нагрузки. Для спортсменов с длинным восстановлением.',
        sessions: [
          { zone: 3, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'С двумя проходками',
        context: 'Проходка в начале + лёгкая проходка в середине + разгрузка.',
        sessions: [
          { zone: 3, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Плавный линейный',
        context: 'Максимально плавное снижение без резких перепадов.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Объёмный сброс расширенный',
        context: 'Volume_only в начале, затем полный сброс к Зоне 1.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Финальная подводка к старту',
        context: 'Одна развивающая → четыре сессии снижения. Последние две — Зона 1.',
        sessions: [
          { zone: 3, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
    ],
    6: [
      {
        variantId: 'v1',
        name: 'Длинная подводка после ударного блока',
        context: 'Шесть дней разгрузки после тяжёлого мезоцикла.',
        sessions: [
          { zone: 3, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Ступенчатый с плато',
        context: 'Три дня Зоны 2 → два дня Зоны 1 → финиш Зоной 1.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'С проходкой и длинной разгрузкой',
        context: 'Проходка в начале + пять дней снижения.',
        sessions: [
          { zone: 3, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Плавный сброс с вариацией стратегий',
        context: 'Шесть дней убывания с разнообразными стратегиями.',
        sessions: [
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'pace_only' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Прогрессивное затухание',
        context: 'Каждые две сессии — на ступень ниже.',
        sessions: [
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'volume_only' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
    ],
  }
}

function getRecoveryTemplates() {
  return {
    3: [
      {
        variantId: 'v1',
        name: 'Минимальное восстановление',
        context: 'Три лёгкие сессии Зоны 1. Полная разгрузка после соревнований.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Восстановление с лёгкой работой',
        context: 'Две Зоны 1 + одна Зона 2. Поддержание двигательного стереотипа.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Вариативное восстановление',
        context: 'Variative доминирует. Мягкая мультипараметрическая разгрузка.',
        sessions: [
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Восстановление с нарастанием',
        context: 'Зона 1 → 1 → 2. Мостик к следующему мезоциклу.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Чистое восстановление',
        context: 'Все Зоны 1, balanced. Максимальный покой для ОДА и ЦНС.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
    ],
    4: [
      {
        variantId: 'v1',
        name: 'Стандартное восстановление',
        context: 'Три дня Зоны 1 + один Зоны 2. Классика после соревнований.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Равномерное чередование',
        context: 'Чередование Зон 1 и 2. Поддержание тонуса при восстановлении.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Глубокое восстановление',
        context: 'Четыре сессии Зоны 1. Полный покой после тяжёлого блока.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Восстановление с объёмным финалом',
        context: 'Три Зоны 1 + одна volume_only Зоны 2 в конце. Подготовка к втягиванию.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'volume_only' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Вариативное четырёхдневное',
        context: 'Variative-стратегия для мягкого восстановления по всем параметрам.',
        sessions: [
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
    ],
    5: [
      {
        variantId: 'v1',
        name: 'Расширенное после чемпионата',
        context: 'Пять дней восстановления. После главного старта сезона.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'С двумя рабочими',
        context: 'Три Зоны 1 + две Зоны 2. Поддержание формы при восстановлении.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Полный покой',
        context: 'Все пять сессий Зоны 1. Максимальное восстановление.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Нарастающее восстановление',
        context: 'От полного покоя к лёгкой работе. Зоны 1-1-1-2-2.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Волнообразное восстановление',
        context: 'Лёгкие волны в Зоне 1 с одним выходом в Зону 2.',
        sessions: [
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
        ],
      },
    ],
    6: [
      {
        variantId: 'v1',
        name: 'Длинное восстановление после сезона',
        context: 'Шесть дней. Завершение макроцикла, переход к межсезонью.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v2',
        name: 'Глубокое шестидневное',
        context: 'Пять Зон 1 + одна Зона 2. Максимальное восстановление.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v3',
        name: 'Чередование с поддержанием',
        context: 'Зоны 1 и 2 поровну. Восстановление с сохранением тонуса.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
        ],
      },
      {
        variantId: 'v4',
        name: 'Вариативное шестидневное',
        context: 'Variative для всех Зон 1. Мягкое восстановление по всем параметрам.',
        sessions: [
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
      {
        variantId: 'v5',
        name: 'Прогрессивное к втягивающему',
        context: 'Нарастание от чистой Зоны 1 к Зоне 2. Мостик к новому мезоциклу.',
        sessions: [
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'balanced' },
          { zone: 1, strategy: 'variative' },
          { zone: 1, strategy: 'balanced' },
          { zone: 2, strategy: 'balanced' },
          { zone: 2, strategy: 'variative' },
        ],
      },
    ],
  }
}

// =============== УНИВЕРСАЛЬНЫЙ БИЛДЕР ====================

function materializeTemplate(template, athletePlan, type) {
  const sessions = []

  for (let i = 0; i < template.sessions.length; i++) {
    const { zone, strategy } = template.sessions[i]
    const variant = lookupVariant(athletePlan, strategy, zone)

    if (!variant) return null
    if (!isAllowedRealism(variant)) return null

    sessions.push(buildSession(i, zone, strategy, variant))
  }

  return {
    variantId: template.variantId,
    name: template.name,
    context: template.context,
    type,
    sessions,
    metadata: computeMetadata(sessions),
  }
}

function buildMicroCycle(athleteData, type) {
  const templates = getTemplates(type)
  const plan = athleteData.plan
  const result = {}

  for (const length of [3, 4, 5, 6]) {
    const lengthTemplates = templates[length]
    if (!lengthTemplates) {
      result[length] = []
      continue
    }
    result[length] = lengthTemplates
      .map((tpl) => materializeTemplate(tpl, plan, type))
      .filter(Boolean)
  }

  return result
}

// ==================== ВАЛИДАТОРЫ =========================

function getValidator(type) {
  switch (type) {
    case 'recovery_intro':
      return validateRecoveryIntro
    case 'base':
      return validateBase
    case 'shock':
      return validateShock
    case 'taper':
      return validateTaper
    case 'recovery':
      return validateRecovery
    default:
      throw new Error(`Нет валидатора для типа: ${type}`)
  }
}

function validateRecoveryIntro(metadata) {
  const { distribution, averagePC1 } = metadata
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)
  const warnings = []

  const lowZones = (distribution[1] || 0) + (distribution[2] || 0)
  const lowZonesRatio = lowZones / total
  const zonesCheck = lowZonesRatio >= 0.9
  if (!zonesCheck) warnings.push(`Доля Зон 1+2 = ${(lowZonesRatio * 100).toFixed(0)}% (≥90%)`)

  const noZone4 = (distribution[4] || 0) === 0
  if (!noZone4) warnings.push(`Зона 4: ${distribution[4]} сессий (исключено)`)

  const noZone3 = (distribution[3] || 0) === 0
  if (!noZone3) warnings.push(`Зона 3: ${distribution[3]} сессий (нетипично)`)

  const pc1Check = averagePC1 < -1.0
  if (!pc1Check) warnings.push(`PC1 = ${averagePC1} (требуется < −1.0)`)

  const noAvoid = (metadata.realismProfile.avoid || 0) === 0
  if (!noAvoid) warnings.push(`avoid-сессий: ${metadata.realismProfile.avoid}`)

  return {
    valid: zonesCheck && noZone4 && noZone3 && pc1Check && noAvoid,
    checks: {
      zonesCheck,
      noZone4,
      noZone3,
      pc1Check,
      noAvoid,
      lowZonesRatio: Math.round(lowZonesRatio * 100),
    },
    warnings,
  }
}

function validateBase(metadata) {
  const { distribution, averagePC1 } = metadata
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)
  const warnings = []

  const zone2Count = distribution[2] || 0
  const zone2Ratio = zone2Count / total
  const zone2Check = zone2Ratio >= 0.5
  if (!zone2Check) warnings.push(`Зона 2 = ${(zone2Ratio * 100).toFixed(0)}% (≥50%)`)

  const zone3Count = distribution[3] || 0
  const zone3Check = zone3Count <= 1
  if (!zone3Check) warnings.push(`Зона 3: ${zone3Count} сессий (≤1)`)

  const noZone4 = (distribution[4] || 0) === 0
  if (!noZone4) warnings.push(`Зона 4: ${distribution[4]} сессий (исключено)`)

  // Нижний порог −0.7: центр Зоны 2 = −0.66
  const pc1Check = averagePC1 >= -0.7 && averagePC1 <= 0.5
  if (!pc1Check) warnings.push(`PC1 = ${averagePC1} (от −0.7 до +0.5)`)

  const noAvoid = (metadata.realismProfile.avoid || 0) === 0
  if (!noAvoid) warnings.push(`avoid-сессий: ${metadata.realismProfile.avoid}`)

  return {
    valid: zone2Check && zone3Check && noZone4 && pc1Check && noAvoid,
    checks: {
      zone2Check,
      zone2Ratio: Math.round(zone2Ratio * 100),
      zone3Check,
      zone3Count,
      noZone4,
      pc1Check,
      noAvoid,
    },
    warnings,
  }
}

/**
 * Критерии ударного микроцикла:
 * (а) ≥1 сессия в Зоне 3 или 4
 * (б) ≥1 сессия в Зоне 1 (компенсаторная)
 * (в) средний PC1 ≥ −0.15
 *     (обязательная Зона 1 с центром −2.5 смещает среднее вниз;
 *      порог калиброван по реальным данным: Z4+Z1+Z3 → PC1=0.08,
 *      Z4+Z1+Z2+Z3 → PC1=−0.10; +0.3 исключает все комбинации
 *      с компенсацией и Зоной 2)
 * (г) нет avoid-сессий
 */
function validateShock(metadata) {
  const { distribution, averagePC1 } = metadata
  const warnings = []

  const highZones = (distribution[3] || 0) + (distribution[4] || 0)
  const highCheck = highZones >= 1
  if (!highCheck) warnings.push(`Зон 3+4: ${highZones} (≥1)`)

  const zone1Count = distribution[1] || 0
  const compensationCheck = zone1Count >= 1
  if (!compensationCheck) warnings.push(`Зона 1: ${zone1Count} (≥1 компенсаторная)`)

  const pc1Check = averagePC1 >= -0.15
  if (!pc1Check) warnings.push(`PC1 = ${averagePC1} (≥ −0.15)`)

  const noAvoid = (metadata.realismProfile.avoid || 0) === 0
  if (!noAvoid) warnings.push(`avoid-сессий: ${metadata.realismProfile.avoid}`)

  return {
    valid: highCheck && compensationCheck && pc1Check && noAvoid,
    checks: { highCheck, highZones, compensationCheck, zone1Count, pc1Check, noAvoid },
    warnings,
  }
}

/**
 * Подводящий микроцикл:
 * (а) убывающая динамика зон (Спирмен ≤ −0.5)
 *     (порог −0.5 а не −0.7: при 3 сессиях Спирмен дискретен,
 *      последовательность 2→2→1 даёт ровно −0.87,
 *      а 3→2→1 даёт −1.0; при 4 сессиях волновые варианты
 *      типа 2→1→2→1 дают −0.63)
 * (б) последняя сессия — Зона 1
 * (в) нет Зоны 4
 * (г) средний PC1 < 0
 * (д) нет avoid-сессий
 */
function validateTaper(metadata) {
  const { distribution, averagePC1, spearman, lastZone } = metadata
  const warnings = []

  const spearmanCheck = spearman <= -0.5
  if (!spearmanCheck) warnings.push(`Спирмен = ${spearman} (≤ −0.5)`)

  const lastZoneCheck = lastZone === 1
  if (!lastZoneCheck) warnings.push(`Последняя сессия: Зона ${lastZone} (должна быть 1)`)

  const noZone4 = (distribution[4] || 0) === 0
  if (!noZone4) warnings.push(`Зона 4: ${distribution[4]} (исключено)`)

  const pc1Check = averagePC1 < 0
  if (!pc1Check) warnings.push(`PC1 = ${averagePC1} (< 0)`)

  const noAvoid = (metadata.realismProfile.avoid || 0) === 0
  if (!noAvoid) warnings.push(`avoid: ${metadata.realismProfile.avoid}`)

  return {
    valid: spearmanCheck && lastZoneCheck && noZone4 && pc1Check && noAvoid,
    checks: { spearmanCheck, spearman, lastZoneCheck, lastZone, noZone4, pc1Check, noAvoid },
    warnings,
  }
}

/**
 * Восстановительный микроцикл:
 * (а) Зона 1 ≥ 50%
 * (б) нет Зон 3 и 4
 * (в) средний PC1 < −1.0
 * (г) нет avoid-сессий
 *
 * Биохимически ≈ втягивающий; различается позицией в мезоцикле
 * (после соревнований/ударного блока, а не в начале подготовки)
 */
function validateRecovery(metadata) {
  const { distribution, averagePC1 } = metadata
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)
  const warnings = []

  const zone1Count = distribution[1] || 0
  const zone1Ratio = zone1Count / total
  const zone1Check = zone1Ratio >= 0.5
  if (!zone1Check) warnings.push(`Зона 1 = ${(zone1Ratio * 100).toFixed(0)}% (≥50%)`)

  const noZone3 = (distribution[3] || 0) === 0
  if (!noZone3) warnings.push(`Зона 3: ${distribution[3]} (исключено)`)

  const noZone4 = (distribution[4] || 0) === 0
  if (!noZone4) warnings.push(`Зона 4: ${distribution[4]} (исключено)`)

  const pc1Check = averagePC1 < -1.0
  if (!pc1Check) warnings.push(`PC1 = ${averagePC1} (< −1.0)`)

  const noAvoid = (metadata.realismProfile.avoid || 0) === 0
  if (!noAvoid) warnings.push(`avoid: ${metadata.realismProfile.avoid}`)

  return {
    valid: zone1Check && noZone3 && noZone4 && pc1Check && noAvoid,
    checks: {
      zone1Check,
      zone1Ratio: Math.round(zone1Ratio * 100),
      noZone3,
      noZone4,
      pc1Check,
      noAvoid,
    },
    warnings,
  }
}

// ================ ТОЧКИ ВХОДА (PUBLIC API) ================

/**
 * Создать каталог микроциклов заданного типа для одного спортсмена.
 *
 * @param {Object} athleteData - элемент из allAthletePlans
 * @param {string} type - 'recovery_intro' | 'base' | 'shock' | 'taper' | 'recovery'
 * @returns {Object} { "3": [...], "4": [...], "5": [...], "6": [...] }
 */
export function createCatalog(athleteData, type) {
  const raw = buildMicroCycle(athleteData, type)
  const validate = getValidator(type)
  const result = {}

  for (const [length, variants] of Object.entries(raw)) {
    result[length] = variants.map((variant) => ({
      ...variant,
      validation: validate(variant.metadata),
    }))
  }

  return result
}

/**
 * Создать каталог микроциклов заданного типа для всех спортсменов.
 *
 * @param {Array} allAthletePlans - массив из allAthletePlans
 * @param {string} type - 'recovery_intro' | 'base' | 'shock'
 * @returns {Array<{ athleteId, name, catalog }>}
 */
export function createCatalogForAll(allAthletePlans, type) {
  return allAthletePlans.map((athlete) => ({
    athleteId: athlete.athleteId,
    name: athlete.name,
    catalog: createCatalog(athlete, type),
  }))
}
