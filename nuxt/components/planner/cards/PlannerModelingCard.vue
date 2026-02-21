<template>
  <div class="flex flex-col gap-2">
    <button
      :disabled="!canModel"
      class="h-10 px-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      @click="model"
    >
      Получить 5 вариантов тренировочного плана
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
    <div v-if="!competitionDate">
      Укажите <b>дату соревнований</b>, чтобы активировать расчёт.
    </div>
    <div v-else-if="!hasFilledData">
      <b>Заполните данные по неделям</b> (хотя бы одну тренировку: V, P, R) в
      разделе "Ввод данных по неделям" ниже.
    </div>
  </div>

  <div v-if="activePlan" class="mt-3 text-xs text-slate-600 space-y-2">
    <div>
      Вариант: <b>{{ activeVariant?.title }}</b> · недель:
      <b>{{ activePlan.weeks.length }}</b> · тренировок:
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
</template>

<script setup lang="ts">
type AnyPlan = any
type AnyVariant = any

defineProps<{
  canModel: boolean
  model: () => void
  exportPdf: () => void
  activePlan: AnyPlan | null
  competitionDate: string | null
  hasFilledData: boolean
  activeVariant: AnyVariant | null
  flatPlan: any[]
  planVariants: AnyVariant[]
  activePlanId: string | null
  selectPlan: (id: string) => void
}>()
</script>
