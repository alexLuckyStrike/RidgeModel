import { nextTick } from 'vue'
import {
  useAthletesStore,
  type AllCatalogsByType,
  type Athlete,
  type ComputedAthletePlan,
} from '../../../../stores/athletes'
import { useDataPreperationPCAStore } from '../../../../stores/DataPreperationPCA'
import type { Plan, PlanVariantId } from '../../../../utils/plannerTypes'
import {
  strategyVolumeOnly,
  strategyPaceOnly,
  strategyRecoveryOnly,
  strategyBalanced,
  BASIC_STRATEGIES,
  STRATEGY_NAMES,
  checkRealism,
  strategyVariative,
  type LoadStds,
  type LoadDeltas,
  type Beta,
  type BasicStrategyId,
  type ModelArtifacts,
  type AthleteBaseline,
  type ProposedSession,
  type LoadRanges,
} from './PlannerModelingCard.helpers'

import {
  type FlatRowWithLoads,
  type Standardization,
  type StandardizedResult,
  stabilizeSign,
  normalizeLoads,
  standardizeColumns,
  transposeMatrix,
  multiplyMatrices,
} from './loads_and_matrix'

import {
  logRelativeToBaseLine,
  standardizeMarkers,
  computeCovarianceMatrix,
  jacobiEigenDecomposition,
  projectOnPC1,
  type FlatRowWithPC1,
  type EigenPair,
  type FlatRow,
  type StandardizedRow,
  type MarkerStats,
  type StandardizedFlat,
} from './PCA_pipeline_functions'

import {
  solveLinearSystem,
  ridgeRegression,
  evaluateModel,
  groupKFoldCV,
  selectBestLambda,
  type RidgeResult,
} from './Ridge_regression_functions'

import {
  descaleCoefficients,
  calculatePC1Thresholds,
  calculateFourZoneSystem,
  distributeByZones,
  forecastSession,
} from './Model_application_functions'

import { calculateLoadRanges, exploreStrategy } from './Inverse_task_function'

import { createCatalogForAll } from './microcycle'

import { createFlexMesoForAll } from './mezocycle'

export async function runModel(params: {
  athletes: Athlete[]
  athletePlans: Record<string, Partial<Record<PlanVariantId, Plan>>>
  activePlanId: PlanVariantId
  ensureRowsForAllAthletes: () => void
  applyModel: (
    plans: Record<string, Partial<Record<PlanVariantId, Plan>>>,
    planId: PlanVariantId
  ) => void
  drawCharts: () => void
}) {
  const dataPreperationPCAStore = useDataPreperationPCAStore()
  const athletesStore = useAthletesStore()
  const athletesDataAll = await dataPreperationPCAStore.fetchAllAthletesFromDb()

  //console.log('athletesDataAll:', athletesDataAll)

  //  Здесь мы преобразуем сырые значения биохимических маркеров мочи в
  // логарифмические отклонения от индивидуального baseline для каждого спортсмена.
  const relativeMarkersFromBaselineByAthletes = athletesDataAll.map((athlete) => ({
    athleteId: athlete.id,
    name: athlete.name,
    rows: logRelativeToBaseLine(athlete.rows, athlete.restBaseline),
  }))

  //console.log('relativeMarkersFromBaselineByAthletes:', relativeMarkersFromBaselineByAthletes)

  // Это операция выравнивания (flattening) — преобразование иерархической структуры (спортсмены → их сессии) в плоскую таблицу всех наблюдений.После этой операции мы получаем 576 строк в виде единого массива, готового для дальнейшей статистической обработки.
  const flatRows = relativeMarkersFromBaselineByAthletes.flatMap((athlete) =>
    athlete.rows.map((row) => ({
      athleteId: athlete.athleteId,
      sessionId: row.sessionId,
      V: row.V,
      P: row.P,
      R: row.R,
      xC: row.xC,
      xP: row.xP,
      xM: row.xM,
      xK: row.xK,
    }))
  )

  // console.log('flatRows:', flatRows)
  // Это z-стандартизация четырёх логарифмических маркеров: преобразование, после которого каждый маркер имеет среднее = 0 и стандартное отклонение = 1.
  // Это обязательный шаг перед PCA.
  //   PCA ищет направления максимальной дисперсии в данных. Если маркеры имеют разные масштабы, PCA "увидит", что один маркер сильно варьируется, а другой — слабо, и сделает выводы:

  // "Миоглобин варьируется больше всех (σ = 1.20) — значит, он самый информативный. PC1 будет в основном про миоглобин."

  // Но это ложный вывод. Миоглобин не более информативен — у него просто больше числовая дисперсия из-за биохимических особенностей. PCA не должна "доминировать" один маркер только из-за его разброса.
  const standardized = standardizeMarkers(flatRows)

  // Это построение ковариационной матрицы 4×4 для четырёх стандартизованных маркеров. Эта матрица — фундамент для PCA: именно её мы будем диагонализировать на следующем шаге, чтобы найти главные компоненты.Поскольку маркеры уже стандартизованы (среднее = 0, σ = 1), ковариационная матрица фактически становится корреляционной — каждый элемент показывает корреляцию между парой маркеров.
  const covMatrix = computeCovarianceMatrix(standardized.rows, ['zC', 'zP', 'zM', 'zK'])

  // console.log('Ковариационная матрица:')
  // console.table(covMatrix)

  // метод Якоби
  // Это диагонализация ковариационной матрицы — нахождение её собственных значений и собственных векторов методом Якоби.После этой операции мы получаем главные компоненты (PC1, PC2, PC3, PC4) — направления, в которых данные имеют максимальную дисперсию.Это сердце PCA.
  const eigenPairs = jacobiEigenDecomposition(covMatrix)
  // console.log('eigenPairs:', eigenPairs)

  ///  применение того, что нашёл PCA, к реальным наблюдениям.

  // Это стабилизация знака собственного вектора PC1. Маленькая, но критически важная операция, без которой модель могла бы давать противоположные результаты при разных запусках.
  const pc1Vector = stabilizeSign(eigenPairs[0].vector)

  // console.log('pc1Vector:', pc1Vector)
  // Это проекция четырёхмерных данных (4 стандартизованных маркера) на ось PC1 — превращение четырёх чисел в одно для каждого наблюдения.После этой операции у нас есть PC1 для каждой из 576 сессий — интегральный индекс биохимического отклика.
  const projected = projectOnPC1(standardized.rows, pc1Vector)
  // // console.log('projected:', projected)

  // Это нормализация параметров нагрузки — преобразование абсолютных значений V, P, R в относительные отклонения от индивидуальной нормы каждого спортсмена.После этой операции мы получаем dV, dP, dR — безразмерные величины, готовые для регрессии.Это первый шаг обработки нагрузок (по аналогии с тем, как logRelativeToBaseLine был первым шагом для маркеров).

  const normalized = normalizeLoads(projected)
  // // console.log('normalized:', normalized)

  const { rows: standardizedLoads, standardization } = standardizeColumns(normalized, [
    'dV',
    'dP',
    'dR',
  ])

  // 4 блок

  //Это z-стандартизация выбранных колонок в таблице. Универсальная функция, которая работает с любыми числовыми полями.
  // Из стандартизации:
  const standardizedData = standardizeColumns(normalized, ['dV', 'dP', 'dR'])
  // каждая строка содержит z_dV, z_dP, z_dR

  // Извлекаем матрицу X и вектор y
  //Это подготовка данных в матричный формат и запуск ridge-регрессии. После этого блока мы получаем коэффициенты β, ////связывающие нагрузки с PC1.Здесь происходит переход от "таблицы с разными колонками" (удобной для чтения) к "матрице X и вектору y" (нужной для линейной алгебры).
  const X = standardizedData.rows.map((r) => [r.z_dV, r.z_dP, r.z_dR])
  const y = standardizedData.rows.map((r) => r.PC1)

  // Применяем ridge Получили ridge при оптимальном λ
  const result = ridgeRegression(X, y, 1.0, ['z_dV', 'z_dP', 'z_dR'])
  // console.log('result ridgeRegression', result)
  // Имена в z-масштабе и в исходном масштабе
  const featureNames = ['dV', 'dP', 'dR']

  // Применяем обратное преобразование
  // Это обратное преобразование коэффициентов ridge-регрессии — перевод их из z-масштаба (в котором обучалась модель) в исходный масштаб относительных отклонений нагрузки.После этой операции коэффициенты становятся интерпретируемыми: тренер сразу видит, насколько изменится PC1 при изменении нагрузки на 10%, 20% и т.д.
  const descaled = descaleCoefficients(
    result.beta,
    featureNames,
    standardization.stds // тот объект, что вернула standardizeColumns
  )
  // console.log('descaled:', descaled)

  // Проверка качества
  const metrics = evaluateModel(X, y, result.beta)
  //console.log('metrics:', metrics)

  /// Кросс-валидация

  // Готовим плоскую структуру с нужными полями
  const data = standardizedData.rows.map((r) => ({
    athleteId: r.athleteId,
    PC1: r.PC1,
    z_dV: r.z_dV,
    z_dP: r.z_dP,
    z_dR: r.z_dR,
  }))
  //console.log('data:', data)
  // Запускаем CV с k=5 и lambda=1

  // Выбираем лучший лямбда
  // откуда эти цифры? 0.001, 0.01, 0.1, 1, 10, 100?
  const lambdas = [0, 0.001, 0.01, 0.1, 1, 5, 10, 50, 100]

  const selection = selectBestLambda(data, lambdas, 5)
  //console.log('selection:', selection)

  const thresholds = calculatePC1Thresholds({
    clinicalThresholds: {
      creatinine: { yellow: 4.4, red: 17.7 }, // yellow всё равно посчитаем,
      protein: { yellow: 1.0, red: 3.0 }, // но для финального жёлтого порога
      myoglobin: { yellow: 10, red: 50 }, // используем статистический μ+σ
      ketones: { yellow: 1.5, red: 4.0 },
    },
    athletes: athletesDataAll, // ваши 36 спортсменов
    markerMeans: standardized.means, // из standardizeMarkers
    markerStds: standardized.stds,
    pc1Vector: [0.5319, 0.4752, 0.4854, 0.5056], // ваш [0.5319, 0.4752, 0.4854, 0.5056]
  })
  //  console.log('thresholds:', thresholds)
  // 1. Запускаем расчёт зон
  const zoneSystem = calculateFourZoneSystem({
    clinicalThresholds: {
      creatinine: { attention: 4.4, exceeding: 17.7, danger: 26.5 },
      protein: { attention: 1.0, exceeding: 3.0, danger: 20 },
      myoglobin: { attention: 10, exceeding: 50, danger: 250 },
      ketones: { attention: 1.5, exceeding: 4.0, danger: 16 },
    },
    athletes: athletesDataAll,
    markerMeans: standardized.means,
    markerStds: standardized.stds,
    pc1Vector: [0.5319, 0.4752, 0.4854, 0.5056],
  })

  // 2. Берём массив всех 576 значений PC₁
  const pc1Values = projected.map((r) => r.PC1)
  //  console.log('pc1Values:', pc1Values)
  // 3. Распределяем по зонам
  const distribution = distributeByZones(pc1Values, zoneSystem.thresholds)
  // console.log('distribution:', distribution)
  // 4. Печатаем результат

  //// Калькулятор

  // Готовим артефакты обученной модели
  const modelArtifacts: ModelArtifacts = {
    beta: { V: 7.4787, P: 7.7872, R: -2.5402 },
    thresholds: {
      attention: -1.826,
      exceeding: 0.497,
      danger: 1.575,
    },
    cvRMSE: 0.7436,
    loadStds: { dV: 0.14, dP: 0.138, dR: 0.263 },
    loadRanges: {
      // ← добавили
      dV: { min: -0.256, max: 0.284 },
      dP: { min: -0.3, max: 0.161 },
      dR: { min: -0.583, max: 0.336 },
    },
  }
  //  console.log('modelArtifacts:', modelArtifacts)
  // Индивидуальный профиль спортсмена
  const athleteBaseline: AthleteBaseline = {
    V: 8000, // объём
    P: 75, // интенсивность (% от max)
    R: 3.5, // восстановление (часы)
  }

  // Планируемая тренировка
  const proposedSession: ProposedSession = {
    V: 9000,
    P: 80,
    R: 3,
  }

  // Прогноз
  const forecast = forecastSession(athleteBaseline, proposedSession, modelArtifacts)
  // console.log('forecast:', forecast)
  // решение прямой задачи: прогноз PC₁ для данной тренировки

  // Когда мы решим обратную задачу и предложим тренеру варианты нагрузки,
  // нужно проверить: попадают ли эти варианты в диапазон обучения?

  // Вывод

  //// Тестируем сценарии

  // Используется для проверки реалистичности рекомендаций

  // Считаем диапазоны реалистичности
  const loadRangesData = calculateLoadRanges(normalized)
  // console.log('loadRangesData:', loadRangesData)
  // Печатаем

  const resultus = exploreStrategy({
    baseline: { V: 8000, P: 75, R: 210 },
    artifacts: {
      beta: { V: 7.4787, P: 7.7872, R: -2.5402 },
      thresholds: {
        attention: -1.826,
        exceeding: 0.497,
        danger: 1.575,
      },
      cvRMSE: 0.7436,
      loadStds: { dV: 0.14, dP: 0.138, dR: 0.263 },
      loadRanges: {
        dV: { min: -0.256, max: 0.284 },
        dP: { min: -0.3, max: 0.161 },
        dR: { min: -0.583, max: 0.336 },
      },
    },
  })
  // console.log('resultus:', resultus)
  // Вывод результата

  // for (const athlete of athletesDataAll) {
  //   // const baseline = calculateIndividualBaseline(athlete)
  //   // const plan = exploreStrategy({ baseline, artifacts: modelArtifacts })
  // }

  // console.log('relativeMarkersFromBaselineByAthletes:', relativeMarkersFromBaselineByAthletes)

  const allAthletePlans = relativeMarkersFromBaselineByAthletes.map((athlete) => {
    // 1. Считаем индивидуальную норму V̄, P̄, R̄ по 16 сессиям этого спортсмена
    const n = athlete.rows.length // 16

    let sumV = 0
    let sumP = 0
    let sumR = 0

    for (const row of athlete.rows) {
      sumV += row.V
      sumP += row.P
      sumR += row.R
    }

    const baseline = {
      V: sumV / n,
      P: sumP / n,
      R: sumR / n,
    }

    // 2. Применяем exploreStrategy с этим baseline
    const plan = exploreStrategy({
      baseline,
      artifacts: modelArtifacts,
    })

    // 3. Возвращаем результат с привязкой к спортсмену
    return {
      athleteId: athlete.athleteId,
      name: athlete.name,
      baseline,
      plan,
    }
  })
  athletesStore.setAllAthletePlans(allAthletePlans as ComputedAthletePlan[])

  // console.log('allAthletePlans:', allAthletePlans)
  // 'recovery_intro' | 'base' | 'shock' | 'taper' | 'recovery'
  const shockCatalogs = createCatalogForAll(allAthletePlans, 'shock')
  const recoveryIntroCatalogs = createCatalogForAll(allAthletePlans, 'recovery_intro')
  const baseCatalogs = createCatalogForAll(allAthletePlans, 'base')
  const taperCatalogs = createCatalogForAll(allAthletePlans, 'taper')
  const recoveryCatalogs = createCatalogForAll(allAthletePlans, 'recovery')

  console.log('shockCatalogs:', shockCatalogs)

  const allCatalogsByType: AllCatalogsByType = {
    recovery_intro: recoveryIntroCatalogs,
    base: baseCatalogs,
    shock: shockCatalogs,
    taper: taperCatalogs,
    recovery: recoveryCatalogs,
  }

  console.log('allCatalogsByType:', allCatalogsByType)
  athletesStore.setAllCatalogsByType(allCatalogsByType)

  //createFlexMesoForAll

  // console.log('recoveryIntroCatalogs:', recoveryIntroCatalogs)
  // console.log('baseCatalogs:', baseCatalogs)
  // console.log('taperCatalogs:', taperCatalogs)
  // console.log('recoveryCatalogs:', recoveryCatalogs)

  //// Мезоциклы

  // Мезоциклы (например, для 4 тренировок в неделю)
  // const sessionsPerWeek = 4

  // const mesoRecoveryIntro = createMesoCatalogForAll(
  //   allAthletePlans,
  //   'recovery_intro',
  //   sessionsPerWeek
  // )

  // const mesoBase = createMesoCatalogForAll(allAthletePlans, 'base', sessionsPerWeek)
  // const mesoShock = createMesoCatalogForAll(allAthletePlans, 'shock', sessionsPerWeek)
  // const mesoTaper = createMesoCatalogForAll(allAthletePlans, 'taper', sessionsPerWeek)
  // const mesoRecovery = createMesoCatalogForAll(allAthletePlans, 'recovery', sessionsPerWeek)

  // // console.log('mesoRecoveryIntro:', mesoRecoveryIntro)
  // //console.log('mesoBase:', mesoBase)
  // // console.log('mesoShock:', mesoShock)
  // // console.log('mesoTaper:', mesoTaper)
  // // console.log('mesoRecovery:', mesoRecovery)

  // // Собираем для всех возможных частот (3-6 трен./нед.) и группируем по длине цикла (2-8 недель)
  // const mesoTypes = ['recovery_intro', 'base', 'shock', 'taper', 'recovery'] as const
  // const sessionsPerWeekOptions = [3, 4, 5, 6] as const
  // const mesoWeekKeys = ['2', '3', '4', '5', '6', '7', '8'] as const

  // const mesoCatalogsByWeek: Record<string, unknown[]> = Object.fromEntries(
  //   mesoWeekKeys.map((week) => [week, [] as unknown[]])
  // )

  // for (const sessionsPerWeek of sessionsPerWeekOptions) {
  //   for (const mesoType of mesoTypes) {
  //     const mesoCatalogForType = createMesoCatalogForAll(allAthletePlans, mesoType, sessionsPerWeek)

  //     for (const athleteCatalog of mesoCatalogForType) {
  //       const catalogByWeeks = athleteCatalog.catalog ?? {}

  //       for (const [weekCount, variants] of Object.entries(catalogByWeeks)) {
  //         if (!Array.isArray(variants)) continue
  //         if (!mesoCatalogsByWeek[weekCount]) mesoCatalogsByWeek[weekCount] = []

  //         for (const variant of variants) {
  //           mesoCatalogsByWeek[weekCount].push({
  //             athleteId: athleteCatalog.athleteId,
  //             name: athleteCatalog.name,
  //             type: mesoType,
  //             sessionsPerWeek,
  //             ...(variant as Record<string, unknown>),
  //           })
  //         }
  //       }
  //     }
  //   }
  // }

  // console.log('mesoCatalogsByWeek:', mesoCatalogsByWeek)

  params.ensureRowsForAllAthletes()

  const next: Record<string, Partial<Record<PlanVariantId, Plan>>> = {
    ...params.athletePlans,
  }

  params.athletes.forEach((athlete) => {
    next[athlete.id] = {}
  })

  const planId: PlanVariantId = params.activePlanId || 'balanced'
  params.applyModel(next, planId)

  await nextTick()
  params.drawCharts()
}
