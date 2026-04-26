<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight">
          Моделирование микроциклов
        </h1>
        <p class="text-slate-700 mt-2">
          Вводите параметры нагрузки (V/P/R) и маркеры, затем нажимайте
          <b>«Получить модель тренировочного плана»</b>. Приложение построит
          недельные микроциклы, покажет план, график динамики и позволит
          экспортировать результат в PDF.
        </p>
      </div>

      <UiForm :cards="uiFormCards" />
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-slate-600">
          Нажмите, чтобы скрыть или раскрыть блок MVP.
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          @click="toggleMvpBlock"
        >
          <span>{{ mvpCollapsed ? "Показать" : "Скрыть" }}</span>
          <svg
            class="h-4 w-4 transition-transform"
            :class="mvpCollapsed ? '' : 'rotate-180'"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M6 9l6 6 6-6"
            />
          </svg>
        </button>
      </div>
      <transition name="mvp-collapse">
        <NuxtLink
          v-show="!mvpCollapsed"
          to="/cv"
          class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition"
        >
          <svg class="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          MVP 0.1 — Индикаторные полоски
          <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </transition>
    </section>

    <section class="grid gap-6">
      <div>
        <UiCard
          title="Ввод данных по неделям"
          subtitle="Каждая тренировка: V, P, R и маркеры"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm text-slate-600">
              Нажмите, чтобы скрыть или раскрыть блок ввода.
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              @click="toggleWeeksInput"
            >
              <span>{{ weeksInputCollapsed ? "Показать" : "Скрыть" }}</span>
              <svg
                class="h-4 w-4 transition-transform"
                :class="weeksInputCollapsed ? '' : 'rotate-180'"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M6 9l6 6 6-6"
                />
              </svg>
            </button>
          </div>

          <transition name="mvp-collapse">
            <div v-show="!weeksInputCollapsed" class="space-y-4 mt-4">
              <details
                v-for="(athlete, athleteIndex) in athletes"
                :key="athlete.id"
                class="rounded-2xl border bg-white p-4"
                :open="activeAthleteId === athlete.id"
              >
                <summary
                  class="cursor-pointer select-none flex items-center justify-between gap-3"
                  @click="setActiveAthlete(athlete.id)"
                >
                  <div class="font-semibold">
                    Спортсмен {{ athleteIndex + 1 }}
                  </div>
                  <div class="text-xs text-slate-600">
                    Недели: {{ athlete.period.observationWeeks }}
                  </div>
                </summary>

                <div class="mt-4 space-y-4">
                  <ObservationWeek
                    v-for="w in athlete.period.observationWeeks"
                    :key="w"
                    :week="w"
                    :sessions-per-week="athlete.period.sessionsPerWeek"
                    :open="expandedWeeks.includes(w)"
                    :summary="summaryWeek(athlete, w)"
                    :rows="athlete.rows"
                    :chip-text="chipText"
                    :chip-class="chipClass"
                    :key-of="keyOf"
                    @update="(week, session, field, val) => athlete.rows[keyOf(week, session)][field] = val"
                  />
                </div>
              </details>
            </div>
          </transition>
        </UiCard>
      </div>

      <div class="space-y-6 w-full">
        <UiCard
          title="Как построены микроциклы"
          subtitle="Краткое пояснение логики формирования плана"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm text-slate-600">
              Нажмите, чтобы скрыть или раскрыть блок пояснения.
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              @click="toggleMicrocyclesInfo"
            >
              <span>{{ microcyclesInfoCollapsed ? "Показать" : "Скрыть" }}</span>
              <svg
                class="h-4 w-4 transition-transform"
                :class="microcyclesInfoCollapsed ? '' : 'rotate-180'"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M6 9l6 6 6-6"
                />
              </svg>
            </button>
          </div>

          <div v-if="!microcyclesInfoCollapsed && !activePlan" class="text-slate-600 text-sm mt-4">
            Сначала получите варианты тренировочного плана.
          </div>
          <div v-else-if="!microcyclesInfoCollapsed" class="space-y-4 text-sm text-slate-700 mt-4">
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Уравнение микроцикла
              </div>
              <div
                class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800"
              >
                ΔPC1 = β<sub>V</sub>·ΔV + β<sub>P</sub>·ΔP + β<sub>R</sub>·ΔR
              </div>
              <p class="mt-1 text-xs text-slate-500">
                ΔV, ΔP, ΔR — относительные отклонения V / P / R от базы спортсмена;
                ΔPC1 — композитный отклик биомаркеров.
              </p>
            </div>

            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Коэффициенты β (ridge-регрессия, индивидуальные)
              </div>
              <table class="w-full text-left text-sm">
                <thead class="text-xs text-slate-500">
                  <tr>
                    <th class="py-1 pr-2 font-medium">β<sub>V</sub> (объём)</th>
                    <th class="py-1 pr-2 font-medium">β<sub>P</sub> (КПШ)</th>
                    <th class="py-1 pr-2 font-medium">β<sub>R</sub> (паузы)</th>
                    <th class="py-1 font-medium">R²</th>
                  </tr>
                </thead>
                <tbody class="font-mono">
                  <tr>
                    <td class="py-1 pr-2">{{ fmt(compositeModel?.ridge.beta[0], 4) }}</td>
                    <td class="py-1 pr-2">{{ fmt(compositeModel?.ridge.beta[1], 4) }}</td>
                    <td class="py-1 pr-2">{{ fmt(compositeModel?.ridge.beta[2], 4) }}</td>
                    <td class="py-1">{{ fmt(compositeModel?.ridge.r2, 3) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Базовые значения (средние по периоду наблюдения)
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div class="text-[11px] uppercase text-slate-500">Объём</div>
                  <div class="text-slate-900 font-semibold">
                    {{ fmt(baseline.V, 0) }} <span class="text-xs font-normal text-slate-500">кг</span>
                  </div>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div class="text-[11px] uppercase text-slate-500">КПШ</div>
                  <div class="text-slate-900 font-semibold">
                    {{ fmt(baseline.P, 0) }} <span class="text-xs font-normal text-slate-500">подъёмов</span>
                  </div>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div class="text-[11px] uppercase text-slate-500">Паузы</div>
                  <div class="text-slate-900 font-semibold">
                    {{ fmt(baseline.R, 1) }} <span class="text-xs font-normal text-slate-500">мин</span>
                  </div>
                </div>
              </div>
            </div>

            <p class="text-xs text-slate-500">
              Значения подставляются в уравнение: для каждой сессии решается инверсия
              ΔPC1 → (ΔV, ΔP, ΔR) согласно акцентам выбранного варианта плана,
              после чего прогноз биомаркеров сверяется с референсным коридором.
            </p>

            <!-- 5 микроциклов для активного спортсмена (реальные данные) -->
            <div class="pt-2">
              <div class="text-xs uppercase tracking-wide text-slate-500 mb-2">
                5 моделей микроцикла для этого спортсмена
              </div>
              <div
                v-if="!microcycleCards.length"
                class="text-xs text-slate-500"
              >
                Сначала нажмите «Получить варианты плана» — тогда здесь
                появятся 5 микроциклов, посчитанных из ваших наблюдений.
              </div>
              <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  v-for="mc in microcycleCards"
                  :key="mc.id"
                  class="relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div
                    class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r"
                    :class="accentBar[mc.accent]"
                  />
                  <div class="p-3 pt-4">
                    <div class="flex items-baseline justify-between gap-2">
                      <div class="font-semibold text-slate-900">{{ mc.title }}</div>
                      <div class="text-[11px] text-slate-500">микроцикл · 4 сессии</div>
                    </div>
                    <div class="mt-1 text-[11px] font-mono text-slate-600">
                      {{ mc.params }}
                    </div>
                    <div class="mt-1 text-xs text-slate-700">
                      <span class="text-slate-500">Лидер:</span> {{ mc.leader }}
                    </div>

                    <div class="mt-2 overflow-x-auto">
                      <table class="w-full text-[12px]">
                        <thead class="text-[11px] text-slate-500">
                          <tr class="border-b border-slate-200">
                            <th class="py-1 pr-2 text-left font-medium">#</th>
                            <th class="py-1 pr-2 text-right font-medium">V, кг</th>
                            <th class="py-1 pr-2 text-right font-medium">P, с</th>
                            <th class="py-1 pr-2 text-right font-medium">R, с</th>
                            <th class="py-1 pr-2 text-right font-medium">crea</th>
                            <th class="py-1 pr-2 text-right font-medium">prot</th>
                            <th class="py-1 pr-2 text-right font-medium">myo</th>
                            <th class="py-1 pr-2 text-right font-medium">ket</th>
                            <th class="py-1 pr-2 text-left font-medium">Зоны</th>
                            <th class="py-1 text-left font-medium">Флаг</th>
                          </tr>
                        </thead>
                        <tbody class="font-mono">
                          <tr
                            v-for="s in mc.sessions"
                            :key="s.i"
                            class="border-b border-slate-100 last:border-0"
                          >
                            <td class="py-1 pr-2">{{ s.i }}</td>
                            <td class="py-1 pr-2 text-right">{{ s.V }}</td>
                            <td class="py-1 pr-2 text-right">{{ s.P }}</td>
                            <td class="py-1 pr-2 text-right">{{ s.R }}</td>
                            <td class="py-1 pr-2 text-right">{{ s.crea }}</td>
                            <td class="py-1 pr-2 text-right">{{ s.prot }}</td>
                            <td class="py-1 pr-2 text-right">{{ s.myo }}</td>
                            <td class="py-1 pr-2 text-right">{{ s.ket }}</td>
                            <td class="py-1 pr-2">{{ s.zones }}</td>
                            <td class="py-1">
                              <span
                                class="inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-medium"
                                :class="s.flag === 'OK'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'"
                              >
                                {{ s.flag }}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p class="mt-2 text-[11px] text-slate-500 leading-snug">
                      {{ mc.note }}
                    </p>
                  </div>
                </div>
              </div>
              <p v-if="microcycleCards.length" class="mt-2 text-[11px] text-slate-500">
                V/P/R и прогноз маркеров — из реально построенного плана
                (<code>athletePlans[{{ activeAthleteId }}][variantId].weeks[0]</code>).
                Зоны Z1–Zn берутся из шкал <code>MARKER_REFERENCE_SCALES</code>
                (URI-2 Мак + Уриполиан-5А). H_up / H_down пересчитаны через
                индивидуальную PCA-модель спортсмена.
              </p>
            </div>
          </div>
        </UiCard>

        <PlannerCharts
          ref="chartsRef"
          :has-plan="Boolean(activePlan)"
          :sessions="flatPlan"
        />

        <UiCard
          title="Пояснение выбранного плана"
          subtitle="Подробная математика + ссылки на постулаты"
        >
          <div v-if="!activePlan" class="text-slate-600 text-sm">
            Сначала получите варианты тренировочного плана.
          </div>
          <div v-else class="prose max-w-none">
            <div class="font-medium text-slate-900">
              {{ activeVariant?.title }}
            </div>
            <div class="mt-2" v-html="activeVariant?.explanationHtml" />
          </div>
        </UiCard>

        <UiCard title="План" subtitle="Красивое отображение микроциклов">
          <div v-if="!activePlan" class="text-slate-600 text-sm">
            После получения вариантов здесь появится выбранный план микроциклов.
          </div>

          <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PlanWeekCard
              v-for="(w, idx) in activePlan.weeks"
              :key="w.week"
              :week="w"
              :dates="weekDates(idx)"
            />
          </div>
        </UiCard>
      </div>
    </section>
  </div>
</template>


<script setup lang="ts">
import { computed, ref } from 'vue'
import UiCard from '~/components/UiCard.vue'
import UiForm from '~/components/UiForm.vue'
import PlannerCharts from '~/components/planner/PlannerCharts.vue'
import PlanWeekCard from '~/components/planner/PlanWeekCard.vue'
import ObservationWeek from '~/components/planner/ObservationWeek.vue'
import { usePlannerData } from '~/composables/usePlannerData'
import { usePlannerProcessing, VARIANT_DEFAULTS } from '~/composables/usePlannerProcessing'
import { usePlannerDisplay } from '~/composables/usePlannerDisplay'
import { keyOf } from '~/utils/plannerHelpers'
import type { MarkerKey, PlanVariantId, Plan } from '~/utils/plannerTypes'
import {
  MARKER_REFERENCE_SCALES,
  H_up_min,
  headroomDownInPC1,
} from '~/utils/markerCorridors'

// ─── Shared state (owned by orchestrator) ───
const athletePlans = ref<
  Record<string, Partial<Record<PlanVariantId, Plan>>>
>({})
const activePlanId = ref<PlanVariantId>('balanced')
const chartsRef = ref<InstanceType<typeof PlannerCharts> | null>(null)

const mvpCollapsed = ref(true)
const toggleMvpBlock = () => {
  mvpCollapsed.value = !mvpCollapsed.value
}

const microcyclesInfoCollapsed = ref(true)
const toggleMicrocyclesInfo = () => {
  microcyclesInfoCollapsed.value = !microcyclesInfoCollapsed.value
}

const weeksInputCollapsed = ref(true)
const toggleWeeksInput = () => {
  weeksInputCollapsed.value = !weeksInputCollapsed.value
}


const drawCharts = () => chartsRef.value?.drawCharts?.()
const destroyCharts = () => chartsRef.value?.destroyCharts?.()
const getPngDataUrls = () =>
  chartsRef.value?.getPngDataUrls?.() ?? { V: '', P: '', R: '' }

// ─── Group 1: Data Preparation ───
const data = usePlannerData({ athletePlans, destroyCharts })

// Compute activePlan once, share with Group 2 and Group 3
const activePlan = computed(() => {
  const athleteId = data.activeAthleteId.value
  return athletePlans.value[athleteId]?.[activePlanId.value] ?? null
})

// ─── Group 2: Data Processing ───
const processing = usePlannerProcessing({
  activeRows: data.activeRows,
  activeRestBaseline: data.activeRestBaseline,
  activeAthlete: data.activeAthlete,
  competitionDate: data.competitionDate,
  startDate: data.startDate,
  athletes: data.athletes,
  ensureRowsForAllAthletes: data.ensureRowsForAllAthletes,
  getPlanWeeksFor: data.getPlanWeeksFor,
  athletePlans,
  activePlanId,
  activePlan,
  drawCharts,
})

// ─── Group 3: Data Display ───
const display = usePlannerDisplay({
  athletes: data.athletes,
  activeAthleteId: data.activeAthleteId,
  athleteCountModel: data.athleteCountModel,
  setActiveAthlete: data.setActiveAthlete,
  deleteAthlete: data.deleteAthlete,
  getRow: data.getRow,
  fillDemo: data.fillDemo,
  resetAll: data.resetAll,
  activeRestBaseline: data.activeRestBaseline,
  getPlanWeeksFor: data.getPlanWeeksFor,
  canModel: processing.canModel,
  hasFilledData: processing.hasFilledData,
  flatPlan: processing.flatPlan,
  model: processing.model,
  athletePlans,
  activePlanId,
  activePlan,
  competitionDate: data.competitionDate,
  startDate: data.startDate,
  drawCharts,
  getPngDataUrls,

})

// ─── Re-export for template compatibility ───
const {
  athletes,
  activeAthleteId,
  expandedWeeks,
  activeAthlete,
  observationWeeks,
  sessionsPerWeek,
  competitionDate,
  startDate,
  activeRows,
  activeRestBaseline,
  setActiveAthlete,
  deleteAthlete,
  getRow,
} = data

const {
  canModel,
  hasFilledData,
  flatPlan,
  model,
  planWeeks,
  baseline,
  fitCompositeFor,
} = processing

const compositeModel = computed(() => {
  const athlete = activeAthlete.value
  if (!athlete) return null
  return fitCompositeFor(athlete)
})

const fmt = (x: number | null | undefined, digits = 3) =>
  typeof x === 'number' && Number.isFinite(x) ? x.toFixed(digits) : '—'

// ─── Микроциклы из реальных данных активного спортсмена ───

type MicrocycleSession = {
  i: number
  V: number
  P: number
  R: number
  crea: number | null
  prot: number | null
  myo: number | null
  ket: number | null
  zones: string
  flag: 'OK' | 'Внимание'
}
type MicrocycleCard = {
  id: string
  accent: string
  title: string
  params: string
  leader: string
  sessions: MicrocycleSession[]
  note: string
}

const VARIANT_META: Record<
  PlanVariantId,
  { title: string; accent: string; leader: string; direction: 'up' | 'down' }
> = {
  balanced:   { title: 'A — Balanced',   accent: 'sky',     leader: 'Равный вклад V/P/R', direction: 'up' },
  volume:     { title: 'B — Volume',     accent: 'emerald', leader: 'V↑ (объём — основной рычаг)', direction: 'up' },
  intensity:  { title: 'C — Intensity',  accent: 'rose',    leader: 'P↓ (короче пауза — средний вес ↑)', direction: 'up' },
  recovery:   { title: 'D — Recovery',   accent: 'amber',   leader: 'R↑ (паузы растут — движение вниз по PC1)', direction: 'down' },
  performance:{ title: 'E — Performance',accent: 'violet',  leader: 'P↓, back-loaded (пик к концу недели)', direction: 'up' },
}

/** По значению маркера возвращает метку зоны Z1..Zn по шкале референсов. */
function markerZone(m: MarkerKey, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const scale = MARKER_REFERENCE_SCALES[m].values
  for (let i = 0; i < scale.length - 1; i++) {
    if (v <= scale[i + 1]) return `Z${i + 1}`
  }
  return `Z${scale.length - 1}+`
}

function zoneString(markers: Partial<Record<MarkerKey, number>> | undefined): string {
  if (!markers) return '—'
  return (
    markerZone('creatinine', markers.creatinine) + '/' +
    markerZone('protein', markers.protein) + '/' +
    markerZone('myoglobin', markers.myoglobin) + '/' +
    markerZone('ketones', markers.ketones)
  )
}

const round = (x: number | undefined | null, digits = 0) =>
  typeof x === 'number' && Number.isFinite(x)
    ? Number(x.toFixed(digits))
    : null

const microcycleCards = computed<MicrocycleCard[]>(() => {
  const athleteId = activeAthleteId.value
  if (!athleteId) return []
  const plans = athletePlans.value[athleteId]
  if (!plans) return []

  const athlete = activeAthlete.value
  const composite = athlete ? fitCompositeFor(athlete) : null
  const b = baseline.value
  const rest: Record<MarkerKey, number> = {
    creatinine: b.creatinine,
    protein: b.protein,
    myoglobin: b.myoglobin,
    ketones: b.ketones,
  }
  const current: Record<MarkerKey, number> = { ...rest }

  const ids: PlanVariantId[] = ['balanced', 'volume', 'intensity', 'recovery', 'performance']
  const out: MicrocycleCard[] = []

  for (const id of ids) {
    const plan = plans[id]
    const meta = VARIANT_META[id]
    const settings = VARIANT_DEFAULTS[id]
    if (!plan || !plan.weeks.length) continue

    const week = plan.weeks[0]
    const sessions: MicrocycleSession[] = week.sessions.map((s, idx) => ({
      i: idx + 1,
      V: Math.round(s.V),
      P: Math.round(s.P),
      R: Number(s.R.toFixed(1)),
      crea: round(s.markersPredicted?.creatinine, 2),
      prot: round(s.markersPredicted?.protein, 2),
      myo:  round(s.markersPredicted?.myoglobin, 1),
      ket:  round(s.markersPredicted?.ketones, 2),
      zones: zoneString(s.markersPredicted),
      flag: s.flag,
    }))

    // Headroom/ΔPC1_week — только если есть индивидуальная PCA-модель
    let headroomStr = 'н/д'
    if (composite) {
      const h = meta.direction === 'up'
        ? H_up_min(current, rest, composite.pca).value
        : headroomDownInPC1(current, rest, composite.pca)
      const dpc1 = (meta.direction === 'up' ? 1 : -1) * settings.alphaWeek * h
      headroomStr = `H_${meta.direction} = ${h.toFixed(2)} · ΔPC1_week = ${dpc1.toFixed(2)}`
    }

    const accents = settings.accentShares
      .map((x) => x.toFixed(2))
      .join(', ')
    const params =
      `α_week = ${settings.alphaWeek} · ${settings.sessionDistribution} · ` +
      `accentShares [${accents}] · ${headroomStr}`

    const hasWarn = sessions.some((s) => s.flag === 'Внимание')
    const peak = sessions.reduce(
      (acc, s) => (s.V > acc.V ? s : acc),
      sessions[0],
    )
    const note = hasWarn
      ? `Одна из сессий вышла за коридор — см. флаг «Внимание». Пик объёма — S${peak?.i} (V=${peak?.V} кг).`
      : `Все сессии в коридоре. Пик объёма — S${peak?.i} (V=${peak?.V} кг).`

    out.push({
      id,
      accent: meta.accent,
      title: meta.title,
      params,
      leader: meta.leader,
      sessions,
      note,
    })
  }

  return out
})

const accentBar: Record<string, string> = {
  sky: 'from-sky-500 to-sky-300',
  emerald: 'from-emerald-500 to-emerald-300',
  rose: 'from-rose-500 to-rose-300',
  amber: 'from-amber-500 to-amber-300',
  violet: 'from-violet-500 to-violet-300',
}

const {
  activeVariant,
  uiFormCards,
  chipText,
  chipClass,
  summaryWeek,
  selectPlan,
  weekDates,
  exportPdf,
} = display


</script>


<style scoped>
:deep(.mvp-collapse-enter-active),
:deep(.mvp-collapse-leave-active) {
  transition: max-height 0.3s ease, opacity 0.3s ease;
}
:deep(.mvp-collapse-enter-from),
:deep(.mvp-collapse-leave-to) {
  max-height: 0;
  opacity: 0;
}
:deep(.mvp-collapse-enter-to),
:deep(.mvp-collapse-leave-from) {
  max-height: 4000px;
  opacity: 1;
}
.input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 12px;
  background: #ffffff;
  outline: none;
}
.input:focus {
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.45);
  border-color: #cbd5e1;
}
</style>
