import { nextTick } from 'vue'
import type { Athlete } from '../../../../stores/athletes'
import { useDataPreperationPCAStore } from '../../../../stores/DataPreperationPCA'
import type { Plan, PlanVariantId } from '../../../../utils/plannerTypes'
import {
  logRelativeToBaseLine,
  standardizeMarkers,
  computeCovarianceMatrix,
  jacobiEigenDecomposition,
  projectOnPC1,
  stabilizeSign,
  normalizeLoads,
  standardizeColumns,
  transposeMatrix,
  multiplyMatrices,
  solveLinearSystem,
  ridgeRegression,
  evaluateModel,
  groupKFoldCV,
  selectBestLambda,
  descaleCoefficients,
  calculatePC1Thresholds,
  calculateFourZoneSystem,
  distributeByZones,
  forecastSession,
  type ModelArtifacts,
  type AthleteBaseline,
  type ProposedSession,
} from './PlannerModelingCard.helpers'

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
  const athletesDataAll = await dataPreperationPCAStore.fetchAllAthletesFromDb()

  // console.log('athletesDataAll:', athletesDataAll)

  const relativeMarkersFromBaselineByAthletes = athletesDataAll.map((athlete) => ({
    athleteId: athlete.id,
    name: athlete.name,
    rows: logRelativeToBaseLine(athlete.rows, athlete.restBaseline),
  }))

  // console.log('relativeMarkersFromBaselineByAthletes:', relativeMarkersFromBaselineByAthletes)

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

  const standardized = standardizeMarkers(flatRows)

  //console.log('standardized:', standardized)

  ////

  const covMatrix = computeCovarianceMatrix(standardized.rows, ['zC', 'zP', 'zM', 'zK'])

  // console.log('Ковариационная матрица:')
  console.table(covMatrix)

  // метод Якоби

  const eigenPairs = jacobiEigenDecomposition(covMatrix)

  // console.log('Собственные значения:')
  // eigenPairs.forEach((pair, i) => {
  //   console.log(`PC${i + 1}: λ = ${pair.value.toFixed(4)}`)
  // })

  // console.log('\nСобственные векторы:')
  // eigenPairs.forEach((pair, i) => {
  //   console.log(`PC${i + 1}: [${pair.vector.map((v) => v.toFixed(4)).join(', ')}]`)
  // })

  ///  применение того, что нашёл PCA, к реальным наблюдениям.

  const pc1Vector = stabilizeSign(eigenPairs[0].vector)

  const projected = projectOnPC1(standardized.rows, pc1Vector)

  // console.log('Первые 5 наблюдений:')
  // console.table(projected.slice(0, 5))

  // console.log('\nДиапазон PC₁:')
  //  const pc1Values = projected.map((r) => r.PC1)
  // console.log('  min:', Math.min(...pc1Values).toFixed(3))
  // console.log('  max:', Math.max(...pc1Values).toFixed(3))
  // console.log('  mean:', (pc1Values.reduce((s, v) => s + v, 0) / pc1Values.length).toFixed(3))

  //// нормализуем нагрузку!!!

  const normalized = normalizeLoads(projected)

  console.log('Первые 5 строк:')
  console.table(normalized.slice(0, 5))

  const { rows: standardizedLoads, standardization } = standardizeColumns(normalized, [
    'dV',
    'dP',
    'dR',
  ])

  // console.log('Средние:', standardization.means)
  // console.log('Std:', standardization.stds)
  // console.log('Первая строка:', standardizedLoads[0])

  // 4 блок

  // Из стандартизации:
  const standardizedData = standardizeColumns(normalized, ['dV', 'dP', 'dR'])
  // каждая строка содержит z_dV, z_dP, z_dR

  // Извлекаем матрицу X и вектор y
  const X = standardizedData.rows.map((r) => [r.z_dV, r.z_dP, r.z_dR])
  const y = standardizedData.rows.map((r) => r.PC1)

  // Применяем ridge Получили ridge при оптимальном λ
  const result = ridgeRegression(X, y, 1.0, ['z_dV', 'z_dP', 'z_dR'])

  // Имена в z-масштабе и в исходном масштабе
  const featureNames = ['dV', 'dP', 'dR']

  // Применяем обратное преобразование
  const descaled = descaleCoefficients(
    result.beta,
    featureNames,
    standardization.stds // тот объект, что вернула standardizeColumns
  )

  console.log('=== Финальная модель ===')
  console.log()
  console.log('В стандартизованных единицах (z-масштаб):')
  featureNames.forEach((name) => {
    console.log(`  β_${name}_z = ${descaled.betaInZScale[name].toFixed(4)}`)
  })

  console.log()
  console.log('В исходных единицах (относительные отклонения):')
  featureNames.forEach((name) => {
    console.log(
      `  β_${name} = ${descaled.betaInOriginalScale[name].toFixed(4)}  ` +
        `(σ = ${descaled.stdsUsed[name].toFixed(4)})`
    )
  })

  console.log()
  console.log('Интерпретация:')
  console.log('  Изменение dV на +0.10 (+10% от индивидуальной нормы):')
  console.log(`    → ΔPC₁ ≈ ${(descaled.betaInOriginalScale.dV * 0.1).toFixed(3)}`)
  console.log('  Изменение dP на +0.10 (+10% от индивидуальной нормы):')
  console.log(`    → ΔPC₁ ≈ ${(descaled.betaInOriginalScale.dP * 0.1).toFixed(3)}`)
  console.log('  Изменение dR на +0.10 (+10% от индивидуальной нормы):')
  console.log(`    → ΔPC₁ ≈ ${(descaled.betaInOriginalScale.dR * 0.1).toFixed(3)}`)

  // console.log('Коэффициенты:')
  // result.featureNames.forEach((name, i) => {
  //   console.log(`  ${name}: ${result.beta[i].toFixed(4)}`)
  // })
  // console.log(`(λ = ${result.lambda})`)

  // const lambdas = [0, 0.1, 1, 10, 100]
  // console.log('λ        β_V        β_P        β_R')
  // for (const lam of lambdas) {
  //   const r = ridgeRegression(X, y, lam, ['z_dV', 'z_dP', 'z_dR'])
  //   console.log(
  //     `${lam.toFixed(2).padStart(6)}  ${r.beta[0].toFixed(4)}  ${r.beta[1].toFixed(4)}  ${r.beta[2].toFixed(4)}`
  //   )
  // }
  // Проверка качества
  const metrics = evaluateModel(X, y, result.beta)

  // console.log('Метрики качества модели:')
  // console.log(`  R²:    ${metrics.r2.toFixed(4)}  (${(metrics.r2 * 100).toFixed(2)}%)`)
  // console.log(`  RMSE:  ${metrics.rmse.toFixed(4)}`)
  // console.log(`  N:     ${metrics.n}`)

  /// Кросс-валидация

  // Готовим плоскую структуру с нужными полями
  const data = standardizedData.rows.map((r) => ({
    athleteId: r.athleteId,
    PC1: r.PC1,
    z_dV: r.z_dV,
    z_dP: r.z_dP,
    z_dR: r.z_dR,
  }))

  // Запускаем CV с k=5 и lambda=1
  //const cv = groupKFoldCV(data, 1, 5)

  // console.log('=== Group 5-Fold Cross-Validation ===')
  // console.log(`λ = ${cv.lambda}, k = ${cv.k}`)
  // console.log()

  // console.log('Результаты по фолдам:')
  // cv.folds.forEach((f) => {
  //   console.log(
  //     `Фолд ${f.foldIndex}: тест на ${f.testAthleteIds.length} спортсменах ` +
  //       `(${f.testSize} строк) | train R² = ${f.trainR2.toFixed(3)}, ` +
  //       `test R² = ${f.testR2.toFixed(3)}, RMSE = ${f.testRMSE.toFixed(3)}`
  //   )
  // })

  // console.log()
  // console.log('=== Итоговые метрики ===')
  // console.log(`Средний training R²: ${cv.meanTrainR2.toFixed(4)}`)
  // console.log(`Средний CV-R²:       ${cv.meanCVR2.toFixed(4)} ± ${cv.stdCVR2.toFixed(4)}`)
  // console.log(`Средняя CV-RMSE:     ${cv.meanCVRMSE.toFixed(4)}`)

  // Выбираем лучший лямбда

  const lambdas = [0, 0.001, 0.01, 0.1, 1, 5, 10, 50, 100]

  const selection = selectBestLambda(data, lambdas, 5)

  // console.log('=== Подбор оптимального λ через 5-fold CV ===')
  // console.log()
  // console.log('λ         CV-R²              CV-RMSE')
  // console.log('─'.repeat(45))
  // selection.results.forEach((r) => {
  //   const marker = r.lambda === selection.bestLambda ? '  ← лучшее' : ''
  //   console.log(
  //     `${r.lambda.toString().padStart(8)}  ` +
  //       `${r.meanCVR2.toFixed(4)} ± ${r.stdCVR2.toFixed(4)}  ` +
  //       `${r.meanCVRMSE.toFixed(4)}${marker}`
  //   )
  // })
  // console.log('─'.repeat(45))
  // console.log()
  // console.log(`Оптимальное λ = ${selection.bestLambda}`)
  // console.log(`CV-R²         = ${selection.bestCVR2.toFixed(4)}`)
  // console.log(`CV-RMSE       = ${selection.bestCVRMSE.toFixed(4)}`)

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

  // 3. Распределяем по зонам
  const distribution = distributeByZones(pc1Values, zoneSystem.thresholds)

  // 4. Печатаем результат
  // console.log('=== ЧЕТЫРЁХЗОННАЯ СИСТЕМА ===')
  // console.log()
  // console.log('Типичные baseline (медианы по выборке):')
  // Object.entries(zoneSystem.typicalBaseline).forEach(([k, v]) => {
  //   console.log(`  ${k}: ${v}`)
  // })
  // console.log()

  // console.log('PC₁ по уровням и маркерам:')
  // console.log('                attention   exceeding   danger')
  // Object.entries(zoneSystem.pc1ByMarkerByLevel).forEach(([marker, levels]) => {
  //   console.log(
  //     `  ${marker.padEnd(11)} ${levels.attention.toFixed(3).padStart(8)}   ` +
  //       `${levels.exceeding.toFixed(3).padStart(8)}   ${levels.danger.toFixed(3).padStart(8)}`
  //   )
  // })
  // console.log()

  // console.log('Финальные пороги PC₁:')
  // console.log(
  //   `  attention (норма → умеренный):       ${zoneSystem.thresholds.attention.toFixed(3)} (driver: ${zoneSystem.drivingMarkers.attention})`
  // )
  // console.log(
  //   `  exceeding (умеренный → выраженный):  ${zoneSystem.thresholds.exceeding.toFixed(3)} (driver: ${zoneSystem.drivingMarkers.exceeding})`
  // )
  // console.log(
  //   `  danger (выраженный → критический):    ${zoneSystem.thresholds.danger.toFixed(3)} (driver: ${zoneSystem.drivingMarkers.danger})`
  // )
  // console.log()

  // console.log('Распределение 576 наблюдений по зонам:')
  // console.log(
  //   `  Зона 1 (Норма):              ${distribution.zone1_norm} (${distribution.percentByZone.zone1.toFixed(1)}%)`
  // )
  // console.log(
  //   `  Зона 2 (Умеренный отклик):   ${distribution.zone2_moderate} (${distribution.percentByZone.zone2.toFixed(1)}%)`
  // )
  // console.log(
  //   `  Зона 3 (Выраженный отклик):  ${distribution.zone3_pronounced} (${distribution.percentByZone.zone3.toFixed(1)}%)`
  // )
  // console.log(
  //   `  Зона 4 (Критический):        ${distribution.zone4_critical} (${distribution.percentByZone.zone4.toFixed(1)}%)`
  // )

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
  }

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

  // Вывод
  console.log('=== ПРОГНОЗ ТРЕНИРОВКИ ===')
  console.log()
  console.log('Относительные отклонения:')
  console.log(`  Объём:           ${(forecast.deltas.dV * 100).toFixed(1)}%`)
  console.log(`  Интенсивность:   ${(forecast.deltas.dP * 100).toFixed(1)}%`)
  console.log(`  Восстановление:  ${(forecast.deltas.dR * 100).toFixed(1)}%`)
  console.log()
  console.log(`Прогноз PC₁: ${forecast.predictedPC1.toFixed(2)}`)
  console.log(
    `Доверительный интервал: [${forecast.confidenceInterval.lower.toFixed(2)}, ${forecast.confidenceInterval.upper.toFixed(2)}]`
  )
  console.log()
  console.log(`Зона ${forecast.zone.code}: ${forecast.zone.name} (${forecast.zone.color})`)
  console.log(`  ${forecast.zone.description}`)
  console.log()
  console.log('Раскладка прогноза по факторам:')
  console.log(
    `  Объём:           ${forecast.contributions.volume.value.toFixed(2)} (${forecast.contributions.volume.percent}%)`
  )
  console.log(
    `  Интенсивность:   ${forecast.contributions.pace.value.toFixed(2)} (${forecast.contributions.pace.percent}%)`
  )
  console.log(
    `  Восстановление:  ${forecast.contributions.recovery.value.toFixed(2)} (${forecast.contributions.recovery.percent}%)`
  )
  console.log()
  console.log(`Главный фактор: ${forecast.dominantFactor}`)
  console.log()
  console.log('Рекомендация:')
  console.log(`  ${forecast.recommendation}`)

  //// Тестируем сценарии

  ///// Неясно для чего эта функция

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
