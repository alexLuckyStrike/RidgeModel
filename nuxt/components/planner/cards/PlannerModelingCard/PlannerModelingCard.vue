<template>
  <div>
    <div class="flex flex-col gap-2">
      <!--  :disabled="!canModel"-->
      <button
        class="h-10 px-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        @click="onModel"
      >
        Получить 5 вариантов тренировочного плана (отключено)
      </button>
      <button
        :disabled="!activePlan"
        class="h-10 px-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50"
        @click="exportPdf"
      >
        Скачать PDF (выбранный план + график)
      </button>
    </div>

    <div v-if="!canModel" class="mt-3 text-xs text-slate-600 space-y-1">
      <div>Расчёт временно отключён. Текущий модуль очищен перед полной переработкой.</div>
    </div>

    <div v-if="activePlan" class="mt-3 text-xs text-slate-600 space-y-2">
      <div>
        Вариант: <b>{{ activeVariant?.title }}</b> · недель: <b>{{ activePlan.weeks.length }}</b> ·
        тренировок:
        <b>{{ flatPlan.length }}</b>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="v in planVariants"
          :key="v.id"
          class="px-3 py-2 rounded-xl border text-sm hover:bg-slate-50"
          :class="activePlanId === v.id ? 'bg-slate-100 border-slate-200' : ''"
          @click="selectPlan(v.id)"
        >
          {{ v.title }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Athlete } from '../../../../stores/athletes'
import type { Plan, PlanVariantId } from '../../../../utils/plannerTypes'
import { runModel } from './runModel'

type AnyVariant = any

const props = defineProps<{
  canModel: boolean
  exportPdf: () => void
  activePlan: Plan | null
  competitionDate: string | null
  hasFilledData: boolean
  activeVariant: AnyVariant | null
  flatPlan: any[]
  planVariants: AnyVariant[]
  activePlanId: PlanVariantId | null
  selectPlan: (id: string) => void
  athletes: Athlete[]
  athletePlans: Record<string, Partial<Record<PlanVariantId, Plan>>>
  ensureRowsForAllAthletes: () => void
  applyModel: (
    plans: Record<string, Partial<Record<PlanVariantId, Plan>>>,
    planId: PlanVariantId
  ) => void
  drawCharts: () => void
}>()

const onModel = async () => {
  await runModel({
    athletes: props.athletes,
    athletePlans: props.athletePlans,
    activePlanId: props.activePlanId ?? 'balanced',
    ensureRowsForAllAthletes: props.ensureRowsForAllAthletes,
    applyModel: props.applyModel,
    drawCharts: props.drawCharts,
  })
}
</script>
