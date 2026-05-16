<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight">Моделирование микроциклов</h1>
        <p class="text-slate-700 mt-2">
          Вводите параметры нагрузки (V/P/R) и маркеры. Текущий модуль расчёта временно отключён и
          очищен для полной переработки.
        </p>
      </div>

      <UiForm :cards="uiFormCards" />
      <!-- <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-slate-600">Нажмите, чтобы скрыть или раскрыть блок MVP.</div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          @click="toggleMvpBlock"
        >
          <span>{{ mvpCollapsed ? 'Показать' : 'Скрыть' }}</span>
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
      </div> -->
      <!-- <transition name="mvp-collapse">
        <NuxtLink
          v-show="!mvpCollapsed"
          to="/cv"
          class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition"
        >
          <svg class="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          MVP 0.1 — Индикаторные полоски
          <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </NuxtLink>
      </transition> -->
    </section>

    <section class="grid gap-6">
      <div>
        <ShowMicroCycle />
        <!-- <UiCard title="Ввод данных по неделям" subtitle="Каждая тренировка: V, P, R и маркеры">
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm text-slate-600">Нажмите, чтобы скрыть или раскрыть блок ввода.</div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              @click="toggleWeeksInput"
            >
              <span>{{ weeksInputCollapsed ? 'Показать' : 'Скрыть' }}</span>
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
                  <div class="font-semibold">Спортсмен {{ athleteIndex + 1 }}</div>
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
                    @update="
                      (week, session, field, val) =>
                        (athlete.rows[keyOf(week, session)][field] = val)
                    "
                  />
                </div>
              </details>
            </div>
          </transition>
        </UiCard> -->
      </div>

      <div class="space-y-6 w-full">
        <!-- <UiCard title="Расчёт" subtitle="Модуль расчёта очищен для полной переработки">
          <div class="text-sm text-slate-600">
            Текущая вычислительная логика временно отключена. После утверждения новой схемы здесь
            подключим переработанный расчёт.
          </div>
        </UiCard> -->

        <!-- <PlannerCharts ref="chartsRef" :has-plan="Boolean(activePlan)" :sessions="flatPlan" /> -->

        <!-- <UiCard
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
        </UiCard> -->

        <!-- <UiCard title="План" subtitle="Красивое отображение микроциклов">
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
        </UiCard> -->
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiCard from '~/components/UiCard.vue'
import UiForm from '~/components/UiForm.vue'
import ShowMicroCycle from '~/components/ShowMicroCycle.vue'
import PlannerCharts from '~/components/planner/PlannerCharts.vue'
import PlanWeekCard from '~/components/planner/PlanWeekCard.vue'
import ObservationWeek from '~/components/planner/ObservationWeek.vue'
import { usePlannerData } from '~/composables/usePlannerData'
import { usePlannerProcessing } from '~/composables/usePlannerProcessing'
import { usePlannerDisplay } from '~/composables/usePlannerDisplay'
import { keyOf } from '~/utils/plannerHelpers'
import type { PlanVariantId, Plan } from '~/utils/plannerTypes'

// ─── Shared state (owned by orchestrator) ───
const athletePlans = ref<Record<string, Partial<Record<PlanVariantId, Plan>>>>({})
const activePlanId = ref<PlanVariantId>('balanced')
const chartsRef = ref<InstanceType<typeof PlannerCharts> | null>(null)

const mvpCollapsed = ref(true)
const toggleMvpBlock = () => {
  mvpCollapsed.value = !mvpCollapsed.value
}

const weeksInputCollapsed = ref(true)
const toggleWeeksInput = () => {
  weeksInputCollapsed.value = !weeksInputCollapsed.value
}

const drawCharts = () => chartsRef.value?.drawCharts?.()
const destroyCharts = () => chartsRef.value?.destroyCharts?.()
const getPngDataUrls = () => chartsRef.value?.getPngDataUrls?.() ?? { V: '', P: '', R: '' }

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
  getPlanWeeksFor: data.getPlanWeeksFor,
  activePlan,
})

// ─── Group 3: Data Display ───
const display = usePlannerDisplay({
  athletes: data.athletes,
  activeAthleteId: data.activeAthleteId,
  athleteCountModel: data.athleteCountModel,
  setActiveAthlete: data.setActiveAthlete,
  deleteAthlete: data.deleteAthlete,
  getRow: data.getRow,
  applyLoadedAthletes: data.applyLoadedAthletes,
  resetAll: data.resetAll,
  activeRestBaseline: data.activeRestBaseline,
  getPlanWeeksFor: data.getPlanWeeksFor,
  canModel: processing.canModel,
  hasFilledData: processing.hasFilledData,
  flatPlan: processing.flatPlan,
  ensureRowsForAllAthletes: data.ensureRowsForAllAthletes,
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

const { canModel, hasFilledData, flatPlan } = processing

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
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
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
