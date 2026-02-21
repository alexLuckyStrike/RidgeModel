<template>
  <div class="mt-3">
    <button
      type="button"
      class="h-10 px-3 rounded-xl border text-sm font-medium hover:bg-slate-50"
      @click="athleteCountModel.value = athleteCountModel.value + 1"
    >
      Добавить спортсмена
    </button>
  </div>
  <div class="mt-4 space-y-4">
    <div
      v-for="(athlete, athleteIndex) in athletes"
      :key="athlete.id"
      class="rounded-2xl border bg-white p-4"
      :class="activeAthleteId === athlete.id ? 'border-slate-300' : 'border-slate-200'"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="font-semibold">Спортсмен {{ athleteIndex + 1 }}</div>
        <button
          type="button"
          class="text-xs text-slate-500 hover:text-slate-800"
          @click="setActiveAthlete(athlete.id)"
        >
          Сделать активным
        </button>
        <button
          v-if="athletes.length > 1"
          type="button"
          class="text-xs text-rose-600 hover:text-rose-700"
          @click="deleteAthlete(athlete.id)"
        >
          Удалить
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 mt-3">
        <UiField label="Недели наблюдения">
          <input
            v-model.number="athlete.period.observationWeeks"
            type="number"
            min="1"
            max="52"
            class="input"
          />
        </UiField>
        <UiField label="Тренировок/нед">
          <input
            v-model.number="athlete.period.sessionsPerWeek"
            type="number"
            min="1"
            max="10"
            class="input"
          />
        </UiField>
      </div>
      <div class="mt-3">
        <div class="grid grid-cols-2 gap-3">
          <UiField label="Дата начала плана">
            <input v-model="athlete.period.startDate" type="date" class="input" />
          </UiField>
          <UiField label="Недель до старта">
            <input :value="getPlanWeeksFor(athlete)" type="number" class="input" disabled />
          </UiField>
        </div>
        <UiField label="Дата соревнований">
          <input v-model="athlete.period.competitionDate" type="date" class="input" />
        </UiField>
        <div class="text-xs text-slate-600 mt-2">
          План формируется <b>до даты соревнований</b> (от даты начала плана).
          «Недели наблюдения» — это период, в котором вы вводите данные заборов
          биоматериала (база для регрессии).
        </div>
      </div>
    </div>

    <UiField label="Спортсмены">
      <input
        v-model.number="athleteCountModel.value"
        type="number"
        min="1"
        max="50"
        class="input"
      />
    </UiField>
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue'

type Athlete = any

defineProps<{
  athletes: Athlete[]
  activeAthleteId: string
  athleteCountModel: Ref<number>
  setActiveAthlete: (id: string) => void
  deleteAthlete: (id: string) => void
  getPlanWeeksFor: (athlete: Athlete) => number
}>()
</script>
