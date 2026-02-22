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
      <div
        class="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 px-6 py-5 text-left transition hover:bg-slate-50"
          @click="toggleMvp"
        >
          <div>
            <div class="text-lg font-semibold text-slate-900">
              MVP 0.1 — Индикаторные полоски
            </div>
            <p class="mt-1 text-sm text-slate-600">
              Загрузите шкалы, фото полосок и описание нагрузки, чтобы
              автоматически распознать цвета и текст.
            </p>
          </div>
          <span
            class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white"
          >
            <svg
              class="h-5 w-5 text-slate-600 transition-transform duration-300"
              :class="mvpCollapsed ? '' : 'rotate-180'"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M6 9л6 6 6-6"
              />
            </svg>
          </span>
        </button>
        <transition name="mvp-collapse">
          <div
            v-show="!mvpCollapsed"
            class="border-t border-slate-100 bg-slate-50/60 overflow-hidden"
          >
            <div class="space-y-6 px-6 py-6">
              <UiForm
                :cards="mvpCards"
                wrapper-class="grid gap-6 lg:grid-cols-2 xl:grid-cols-4 mobile-cards-vertical"
              />

              <div class="flex flex-col items-center gap-4">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="mvpLoading || mvpDemoLoading"
                  @click="loadMvpDemoData"
                >
                  <span
                    v-if="mvpDemoLoading"
                    class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"
                  />
                  <span>{{
                    mvpDemoLoading
                      ? "Загружаем MVP демоданные..."
                      : "Загрузить MVP демоданные"
                  }}</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!hasMvpFiles || mvpLoading || mvpDemoLoading"
                  @click="analyzeMvp"
                >
                  <span
                    v-if="mvpLoading"
                    class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  <span>{{
                    mvpLoading ? "Анализируем..." : "Запустить анализ"
                  }}</span>
                </button>
                <p class="text-center text-xs text-slate-500">
                  Поддерживаются изображения JPG, PNG, HEIC до 10 МБ.
                </p>
              </div>

              <div
                v-if="mvpError"
                class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
              >
                {{ mvpError }}
              </div>

              <!-- ── Результаты анализа (новый контракт) ──────────────── -->
              <div v-if="mvpResult" class="space-y-6">

                <!-- Шкалы -->
                <div
                  v-if="mvpResult.meta?.scale_profiles?.length"
                  class="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div class="mb-3 text-base font-semibold text-slate-900">
                    Шкалы (калибровка)
                  </div>
                  <div class="flex flex-wrap gap-3">
                    <div
                      v-for="sp in mvpResult.meta.scale_profiles"
                      :key="sp.id"
                      class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm"
                    >
                      <span class="font-medium text-slate-800">{{ sp.id }}</span>
                      <span class="ml-2 text-slate-500">
                        {{ sp.zone_count }} зон · {{ sp.palette_size }} цветов
                      </span>
                      <div class="mt-0.5 truncate text-xs text-slate-400">
                        {{ sp.filename }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Полоски отдыха -->
                <div
                  v-if="mvpResult.strips?.rest?.length"
                  class="space-y-4"
                >
                  <div class="text-base font-semibold text-slate-900">
                    Полоски отдыха
                  </div>
                  <div
                    v-for="(strip, idx) in mvpResult.strips.rest"
                    :key="`rest-${idx}`"
                    class="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div class="mb-3 flex items-center justify-between gap-3">
                      <div class="text-sm font-medium text-slate-900">
                        {{ strip.photo_filename }}
                      </div>
                      <div class="flex items-center gap-2 text-xs text-slate-500">
                        <span v-if="strip.scale_id" class="rounded-full bg-slate-100 px-2 py-0.5">
                          Шкала: {{ strip.scale_id }}
                        </span>
                        <span>{{ strip.zone_count }} зон</span>
                      </div>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="min-w-full text-sm">
                        <thead>
                          <tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th class="px-3 py-2 font-medium">Зона</th>
                            <th class="px-3 py-2 font-medium">Уровень</th>
                            <th class="px-3 py-2 font-medium">ΔE</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="zone in strip.zones"
                            :key="`rzone-${zone.index}`"
                            class="border-t"
                          >
                            <td class="px-3 py-1.5 text-slate-500">{{ zone.index + 1 }}</td>
                            <td class="px-3 py-1.5 font-medium text-slate-900">{{ zone.level }}</td>
                            <td class="px-3 py-1.5 text-slate-600">
                              {{ zone.delta_e != null ? zone.delta_e.toFixed(1) : '—' }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- Полоски нагрузки -->
                <div
                  v-if="mvpResult.strips?.load?.length"
                  class="space-y-4"
                >
                  <div class="text-base font-semibold text-slate-900">
                    Полоски нагрузки
                  </div>
                  <div
                    v-for="(strip, idx) in mvpResult.strips.load"
                    :key="`load-${idx}`"
                    class="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div class="mb-3 flex items-center justify-between gap-3">
                      <div class="text-sm font-medium text-slate-900">
                        {{ strip.photo_filename }}
                      </div>
                      <div class="flex items-center gap-2 text-xs text-slate-500">
                        <span v-if="strip.scale_id" class="rounded-full bg-slate-100 px-2 py-0.5">
                          Шкала: {{ strip.scale_id }}
                        </span>
                        <span>{{ strip.zone_count }} зон</span>
                      </div>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="min-w-full text-sm">
                        <thead>
                          <tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th class="px-3 py-2 font-medium">Зона</th>
                            <th class="px-3 py-2 font-medium">Уровень</th>
                            <th class="px-3 py-2 font-medium">ΔE</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="zone in strip.zones"
                            :key="`lzone-${zone.index}`"
                            class="border-t"
                          >
                            <td class="px-3 py-1.5 text-slate-500">{{ zone.index + 1 }}</td>
                            <td class="px-3 py-1.5 font-medium text-slate-900">{{ zone.level }}</td>
                            <td class="px-3 py-1.5 text-slate-600">
                              {{ zone.delta_e != null ? zone.delta_e.toFixed(1) : '—' }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- OCR — распознанный текст -->
                <div
                  v-if="mvpResult.ocr?.items?.length"
                  class="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div class="mb-3 text-base font-semibold text-slate-900">
                    Распознанный текст (OCR)
                  </div>
                  <div class="space-y-3">
                    <div
                      v-for="(item, idx) in mvpResult.ocr.items"
                      :key="`ocr-${idx}`"
                      class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div class="mb-1 text-xs text-slate-400">{{ item.filename }}</div>
                      <div class="whitespace-pre-wrap text-sm text-slate-800">
                        {{ item.text || '—' }}
                      </div>
                      <div
                        v-if="item.warning"
                        class="mt-1 text-xs text-amber-600"
                      >
                        ⚠ {{ item.warning }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Примечание от сервиса -->
                <div
                  v-if="mvpResult.meta?.note"
                  class="rounded-2xl border border-dashed border-slate-300 bg-white p-5"
                >
                  <div class="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Примечание
                  </div>
                  <p class="mt-2 text-sm text-slate-600">{{ mvpResult.meta.note }}</p>
                </div>

              </div>
            </div>
          </div>
        </transition>
      </div>
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
                          <div class="mt-3 grid grid-cols-3 gap-3">
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
import { usePlannerMvp } from '~/composables/usePlannerMvp'
import { uid, keyOf } from '~/utils/plannerHelpers'
import type { PlanVariantId, Plan } from '~/utils/plannerTypes'

// ─── Shared state (owned by orchestrator) ───
const athletePlans = ref<
  Record<string, Partial<Record<PlanVariantId, Plan>>>
>({})
const activePlanId = ref<PlanVariantId>('balanced')
const chartsRef = ref<InstanceType<typeof PlannerCharts> | null>(null)

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

// ─── MVP (already extracted) ───
const mvp = usePlannerMvp(uid)

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
  mvp: {
    mvpFiles: mvp.mvpFiles,
    handleMvpFileChange: mvp.handleMvpFileChange,
    removeMvpFile: mvp.removeMvpFile,
    load5Sets: mvp.load5Sets,
    addLoad5Set: mvp.addLoad5Set,
    removeLoad5Set: mvp.removeLoad5Set,
    handleLoad5SetFileChange: mvp.handleLoad5SetFileChange,
    removeLoad5SetFile: mvp.removeLoad5SetFile,
  },
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
  mvpCards,
  chipText,
  chipClass,
  summaryWeek,
  selectPlan,
  statusChip,
  weekDates,
  exportPdf,
} = display

const {
  mvpCollapsed,
  mvpLoading,
  mvpDemoLoading,
  mvpError,
  mvpResult,
  weeksInputCollapsed,
  mvpFiles,
  load5Sets,
  hasMvpFiles,
  toggleMvp,
  toggleWeeksInput,
  handleMvpFileChange,
  removeMvpFile,
  analyzeMvp,
  loadMvpDemoData,
  addLoad5Set,
  removeLoad5Set,
  handleLoad5SetFileChange,
  removeLoad5SetFile,
  MVP_LOAD5_MAX_SETS,
} = mvp
</script>


<style scoped>
@media (max-width: 767px) {
  .mobile-cards-vertical {
    display: flex !important;
    flex-direction: column !important;
    gap: 1.25rem !important;
  }
}
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
