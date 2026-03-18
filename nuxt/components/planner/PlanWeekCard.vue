<template>
  <div class="rounded-2xl border p-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <div class="font-semibold">Неделя {{ week.week }}</div>
        <div class="text-xs text-slate-600 mt-1">
          Модель: <b>{{ week.model }}</b>
        </div>
      </div>
      <div class="text-xs text-slate-600">{{ dates }}</div>
    </div>
    <div class="mt-3 grid gap-3 lg:grid-cols-3">
      <div
        v-for="t in week.sessions"
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
</template>

<script setup lang="ts">
import type { PlannedWeek, PlannedSession } from '~/utils/plannerTypes'

defineProps<{
  week: PlannedWeek
  dates: string
}>()

const statusChip = (t: PlannedSession): string =>
  t.flag === 'OK'
    ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
    : 'bg-amber-50 border border-amber-100 text-amber-800'
</script>
