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
      <NuxtLink
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
                  <details
                    v-for="w in athlete.period.observationWeeks"
                    :key="w"
                    class="rounded-2xl border bg-white p-4"
                    :open="expandedWeeks.includes(w)"
                  >
                    <summary
                      class="cursor-pointer select-none flex items-center justify-between gap-3"
                    >
                      <div class="font-semibold">Неделя {{ w }}</div>
                      <div class="text-xs text-slate-600">
                        {{ summaryWeek(athlete, w) }}
                      </div>
                    </summary>

                    <div class="mt-4 space-y-3">
                      <!-- Mobile cards -->
                      <div class="grid gap-3 lg:hidden">
                        <div
                          v-for="s in athlete.period.sessionsPerWeek"
                          :key="`${w}-${s}`"
                          class="rounded-2xl border p-4"
                        >
                          <div class="flex items-center justify-between">
                            <div class="font-medium">Тренировка {{ s }}</div>
                            <span
                              class="text-xs px-2 py-1 rounded-full"
                              :class="chipClass(getRow(athlete, w, s))"
                              >{{ chipText(getRow(athlete, w, s)) }}</span
                            >
                          </div>
                          <div class="mt-3 grid grid-cols-2 gap-3">
                            <Field label="V (кг)"
                              ><input
                                v-model.number="athlete.rows[keyOf(w, s)].V"
                                type="number"
                                class="input"
                            /></Field>
                            <Field label="P (раз)"
                              ><input
                                v-model.number="athlete.rows[keyOf(w, s)].P"
                                type="number"
                                class="input"
                            /></Field>
                            <Field label="R (мин)"
                              ><input
                                v-model.number="athlete.rows[keyOf(w, s)].R"
                                type="number"
                                step="0.1"
                                class="input"
                            /></Field>
                            <div class="rounded-xl bg-slate-50 border p-3">
                              <div class="text-xs text-slate-600">Подсказка</div>
                              <div class="text-sm text-slate-700 mt-1">
                                P↑ = средний вес↓; P↓ = средний вес↑
                              </div>
                            </div>
                          </div>
                          <div class="mt-3 grid grid-cols-4 gap-3">
                            <Field label="Креатинин"
                              ><input
                                v-model.number="athlete.rows[keyOf(w, s)].creatinine"
                                type="number"
                                step="0.1"
                                class="input"
                            /></Field>
                            <Field label="Белок"
                              ><input
                                v-model.number="athlete.rows[keyOf(w, s)].protein"
                                type="number"
                                step="0.1"
                                class="input"
                            /></Field>
                            <Field label="Миоглобин"
                              ><input
                                v-model.number="athlete.rows[keyOf(w, s)].myoglobin"
                                type="number"
                                step="0.1"
                                class="input"
                            /></Field>
                            <Field label="Кетоны"
                              ><input
                                v-model.number="athlete.rows[keyOf(w, s)].ketones"
                                type="number"
                                step="0.1"
                                class="input"
                            /></Field>
                          </div>
                        </div>
                      </div>

                      <!-- Desktop table -->
                      <div class="hidden lg:block overflow-x-auto">
                        <table class="w-full text-sm">
                          <thead>
                            <tr class="text-left text-slate-600">
                              <th class="py-2 pr-3">Трен.</th>
                              <th class="py-2 pr-3">V</th>
                              <th class="py-2 pr-3">P</th>
                              <th class="py-2 pr-3">R</th>
                              <th class="py-2 pr-3">Креатинин</th>
                              <th class="py-2 pr-3">Белок</th>
                              <th class="py-2 pr-3">Миоглобин</th>
                              <th class="py-2 pr-3">Кетоны</th>
                              <th class="py-2">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr
                              v-for="s in athlete.period.sessionsPerWeek"
                              :key="`${w}-${s}`"
                              class="border-t"
                            >
                              <td class="py-3 pr-3 font-medium">{{ s }}</td>
                              <td class="py-3 pr-3">
                                <input
                                  v-model.number="athlete.rows[keyOf(w, s)].V"
                                  type="number"
                                  class="input h-10 w-28"
                                />
                              </td>
                              <td class="py-3 pr-3">
                                <input
                                  v-model.number="athlete.rows[keyOf(w, s)].P"
                                  type="number"
                                  class="input h-10 w-24"
                                />
                              </td>
                              <td class="py-3 pr-3">
                                <input
                                  v-model.number="athlete.rows[keyOf(w, s)].R"
                                  type="number"
                                  step="0.1"
                                  class="input h-10 w-24"
                                />
                              </td>
                              <td class="py-3 pr-3">
                                <input
                                  v-model.number="athlete.rows[keyOf(w, s)].creatinine"
                                  type="number"
                                  step="0.1"
                                  class="input h-10 w-28"
                                />
                              </td>
                              <td class="py-3 pr-3">
                                <input
                                  v-model.number="athlete.rows[keyOf(w, s)].protein"
                                  type="number"
                                  step="0.1"
                                  class="input h-10 w-24"
                                />
                              </td>
                              <td class="py-3 pr-3">
                                <input
                                  v-model.number="athlete.rows[keyOf(w, s)].myoglobin"
                                  type="number"
                                  step="0.1"
                                  class="input h-10 w-28"
                                />
                              </td>
                              <td class="py-3 pr-3">
                                <input
                                  v-model.number="athlete.rows[keyOf(w, s)].ketones"
                                  type="number"
                                  step="0.1"
                                  class="input h-10 w-24"
                                />
                              </td>
                              <td class="py-3">
                                <span
                                  class="text-xs px-2 py-1 rounded-full"
                                  :class="chipClass(getRow(athlete, w, s))"
                                  >{{ chipText(getRow(athlete, w, s)) }}</span
                                >
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                </div>
              </details>
            </div>
          </transition>
        </UiCard>
      </div>

      <div class="space-y-6 w-full">
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
            <div
              v-for="(w, idx) in activePlan.weeks"
              :key="w.week"
              class="rounded-2xl border p-4"
            >
              <div
                class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <div class="font-semibold">Неделя {{ w.week }}</div>
                  <div class="text-xs text-slate-600 mt-1">
                    Модель: <b>{{ w.model }}</b>
                  </div>
                </div>
                <div class="text-xs text-slate-600">{{ weekDates(idx) }}</div>
              </div>

              <div class="mt-3 grid gap-3 lg:grid-cols-3">
                <div
                  v-for="t in w.sessions"
                  :key="t.id"
                  class="rounded-2xl bg-slate-50 border p-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="font-medium">Тренировка {{ t.session }}</div>
                      <div class="text-xs text-slate-600 mt-1">
                        V={{ t.V }} кг · P={{ t.P }} · R={{ t.R }} мин
                      </div>
                    </div>
                    <span
                      class="text-xs px-2 py-1 rounded-full"
                      :class="statusChip(t)"
                    >
                      {{ t.flag }}
                    </span>
                  </div>

                  <div class="mt-3 text-sm text-slate-800 whitespace-pre-line">
                    {{ t.workout }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UiCard>
      </div>
    </section>
  </div>
</template>


<script setup lang="ts">
import { computed, ref } from 'vue'
import UiCard from '~/components/UiCard.vue'
import Field from '~/components/UiField.vue'
import UiForm from '~/components/UiForm.vue'
import PlannerCharts from '~/components/planner/PlannerCharts.vue'
import { usePlannerData } from '~/composables/usePlannerData'
import { usePlannerProcessing } from '~/composables/usePlannerProcessing'
import { usePlannerDisplay } from '~/composables/usePlannerDisplay'
import { keyOf } from '~/utils/plannerHelpers'
import type { PlanVariantId, Plan } from '~/utils/plannerTypes'

// ─── Shared state (owned by orchestrator) ───
const athletePlans = ref<
  Record<string, Partial<Record<PlanVariantId, Plan>>>
>({})
const activePlanId = ref<PlanVariantId>('balanced')
const chartsRef = ref<InstanceType<typeof PlannerCharts> | null>(null)

const weeksInputCollapsed = ref(false)
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

const { canModel, hasFilledData, flatPlan, model, planWeeks, baseline } = processing

const {
  activeVariant,
  uiFormCards,
  chipText,
  chipClass,
  summaryWeek,
  selectPlan,
  statusChip,
  weekDates,
  exportPdf,
} = display



  if (!results) return []
  const rows: Array<{ key: string; label: string; value: string; unit: string }> = []
  analyteOrder.forEach((key) => {
    const raw = results[key]
    if (typeof raw !== "number" || !Number.isFinite(raw)) return
    const digits = analyteDecimals[key] ?? 2
    rows.push({
      key,
      label: analyteLabels[key] || key,
      value: raw.toFixed(digits),
      unit: units?.[key] || "",
    })
  })
  return rows
}

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
