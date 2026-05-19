<template>
  <div class="space-y-4">
    <div class="rounded-2xl border bg-white p-4">
      <div v-if="showAthleteSelector && availableAthletes.length > 1">
        <div class="text-xs font-medium text-slate-600">Спортсмен</div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="athlete in availableAthletes"
            :key="athlete.athleteId"
            type="button"
            class="px-3 py-2 rounded-xl border text-sm transition"
            :class="athleteButtonClass(athlete.athleteId)"
            @click="selectAthlete(athlete.athleteId)"
          >
            {{ athlete.name }}
          </button>
        </div>
      </div>

      <div class="mt-4 text-xs font-medium text-slate-600">Тип мезоцикла</div>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="typeId in typeOrder"
          :key="typeId"
          type="button"
          class="px-3 py-2 rounded-xl border text-sm transition"
          :class="typeButtonClass(typeId)"
          @click="selectedType = typeId"
        >
          {{ getTypeLabel(typeId) }}
        </button>
      </div>

      <div class="mt-4 text-xs font-medium text-slate-600">Динамика</div>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="dynamics in dynamicsOrder"
          :key="dynamics"
          type="button"
          class="px-3 py-2 rounded-xl border text-sm transition"
          :class="dynamicsButtonClass(dynamics)"
          @click="selectedDynamics = dynamics"
        >
          {{ getDynamicsLabel(dynamics) }}
        </button>
      </div>

      <div class="mt-4">
        <div class="flex items-center justify-between">
          <div class="text-xs font-medium text-slate-600">Количество микроциклов (недель)</div>
          <div class="text-sm font-semibold text-slate-900">{{ weeksCount }}</div>
        </div>
        <input
          class="mt-2 w-full accent-slate-900"
          type="range"
          min="2"
          max="8"
          step="1"
          :value="weeksCount"
          @input="onWeeksInput"
        />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="(sessions, weekIndex) in sessionsPerWeek"
        :key="`week-${weekIndex}`"
        class="rounded-2xl border bg-white p-3"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-slate-900">Микроцикл {{ weekIndex + 1 }}</div>
          <div class="text-xs text-slate-500">{{ sessions }} трен.</div>
        </div>

        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="count in sessionOptions"
            :key="count"
            type="button"
            class="px-2.5 py-1.5 rounded-lg border text-sm transition"
            :class="weekSessionButtonClass(weekIndex, count)"
            @click="setWeekSessions(weekIndex, count)"
          >
            {{ count }}
          </button>
        </div>

        <div class="mt-3 text-xs text-slate-600" v-if="currentWeeks[weekIndex]">
          <div>Уровень: {{ currentWeeks[weekIndex].level }}</div>
          <div>Микроцикл: {{ currentWeeks[weekIndex].microCycle?.name ?? '—' }}</div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border bg-white p-4">
      <template v-if="!hasInputData">
        <div class="text-sm text-slate-600">
          Нет входных данных для генерации мезоцикла. Сначала запустите моделирование, чтобы
          заполнить данные в store.
        </div>
      </template>

      <template v-else-if="!currentMesoCycle">
        <div class="text-sm text-amber-700">
          Не удалось собрать мезоцикл для выбранной конфигурации. Попробуйте изменить динамику, тип
          или количество тренировок по неделям.
        </div>
      </template>

      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <div class="text-base font-semibold text-slate-900">{{ currentMesoCycle.name }}</div>
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
            :class="
              currentMesoCycle.validation?.valid
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            "
          >
            {{ currentMesoCycle.validation?.valid ? 'valid' : 'needs review' }}
          </span>
        </div>

        <div class="mt-2 text-sm text-slate-600">{{ currentMesoCycle.context }}</div>

        <div class="mt-4 space-y-4">
          <section v-for="week in currentWeeks" :key="week.weekNumber" class="space-y-2">
            <div class="text-xs font-medium text-slate-600">
              Неделя {{ week.weekNumber }} · {{ week.sessionsPerWeek }} трен.
            </div>

            <ShowMicroCycleView
              :microcycle="week.microCycle ?? null"
              :sessions="week.microCycle?.sessions ?? []"
              :selected-type="selectedType"
              :selected-sessions="week.sessionsPerWeek"
              :selected-type-label="getTypeLabel(selectedType)"
              :variant-index="0"
              :variant-total="1"
              :can-navigate-variants="false"
            />
          </section>
        </div>

        <div v-if="currentWarnings.length > 0" class="mt-3">
          <div class="text-xs font-medium text-amber-700">Предупреждения</div>
          <div class="mt-1 space-y-1">
            <div
              v-for="(warning, idx) in currentWarnings"
              :key="`warning-${idx}`"
              class="text-xs text-amber-700"
            >
              {{ warning }}
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import ShowMicroCycleView from './ShowMicroCycleView.vue'
import { createFlexMesoForAll } from '~/components/planner/cards/PlannerModelingCard/mezocycle'
import { useAthletesStore } from '~/stores/athletes'

type MesoType = 'recovery_intro' | 'base' | 'shock' | 'taper' | 'recovery'
type MesoDynamics = 'ascending' | 'descending' | 'pendulum' | 'step'
type SessionCount = 3 | 4 | 5 | 6

interface AthletePlanInput {
  athleteId: string
  name: string
  [key: string]: unknown
}

interface MesoWeekResult {
  weekNumber: number
  level: string
  sessionsPerWeek: SessionCount
  microCycle?: {
    variantId?: string
    name?: string
    context?: string
    sessions?: Array<{
      sessionIndex: number
      zone: number
      strategy: string
      predictedPC1: number
      realism: string
      deltas: { dV: number; dP: number; dR: number }
      absoluteLoad?: { V: number; P: number; R: number }
      description?: string
    }>
    metadata?: {
      averagePC1?: number
      spearman?: number
      [key: string]: unknown
    }
    validation?: {
      valid?: boolean
      [key: string]: unknown
    }
    [key: string]: unknown
  } | null
}

interface MesoCycleResult {
  name?: string
  context?: string
  weeks?: MesoWeekResult[]
  validation?: {
    valid?: boolean
    warnings?: unknown[]
  }
}

interface FlexMesoForAthleteResult {
  athleteId: string
  name: string
  mesoCycle: MesoCycleResult | null
}

const typeOrder: MesoType[] = ['recovery_intro', 'base', 'shock', 'taper', 'recovery']
const dynamicsOrder: MesoDynamics[] = ['ascending', 'descending', 'pendulum', 'step']
const sessionOptions: SessionCount[] = [3, 4, 5, 6]

const DEFAULT_TYPE_LABELS: Record<MesoType, string> = {
  recovery_intro: 'Втягивающий',
  base: 'Базовый',
  shock: 'Ударный',
  taper: 'Подводящий',
  recovery: 'Восстановительный',
}

const DEFAULT_DYNAMICS_LABELS: Record<MesoDynamics, string> = {
  ascending: 'Нарастающая',
  descending: 'Нисходящая',
  pendulum: 'Волновая',
  step: 'Ступенчатая',
}

const clampWeeksCount = (value: number): number => {
  const n = Math.floor(Number(value))
  if (Number.isNaN(n)) return 4
  return Math.max(2, Math.min(8, n))
}

const normalizeSessionCount = (value: number): SessionCount => {
  if (value <= 3) return 3
  if (value >= 6) return 6
  if (value === 5) return 5
  return 4
}

const buildSessionsPerWeek = (
  weekCount: number,
  source?: Array<number | SessionCount>
): SessionCount[] => {
  const next: SessionCount[] = []

  for (let i = 0; i < weekCount; i++) {
    const fromSource = source?.[i]
    next.push(typeof fromSource === 'number' ? normalizeSessionCount(fromSource) : 4)
  }

  return next
}

const props = withDefaults(
  defineProps<{
    initialAthleteId?: string | null
    initialType?: MesoType | null
    initialDynamics?: MesoDynamics | null
    initialWeeksCount?: number
    initialSessionsPerWeek?: SessionCount[] | null
    variantId?: string | null
    typeLabels?: Partial<Record<MesoType, string>>
    dynamicsLabels?: Partial<Record<MesoDynamics, string>>
    showAthleteSelector?: boolean
  }>(),
  {
    initialAthleteId: null,
    initialType: 'base',
    initialDynamics: 'ascending',
    initialWeeksCount: 4,
    initialSessionsPerWeek: null,
    variantId: null,
    typeLabels: () => ({}),
    dynamicsLabels: () => ({}),
    showAthleteSelector: true,
  }
)

const emit = defineEmits<{
  (
    e: 'selection-change',
    payload: {
      athleteId: string | null
      type: MesoType
      dynamics: MesoDynamics
      weeksCount: number
      sessionsPerWeek: SessionCount[]
      variantId: string | null
    }
  ): void
  (
    e: 'result-change',
    payload: {
      athleteId: string | null
      resultForAthlete: FlexMesoForAthleteResult | null
      mesoCycle: MesoCycleResult | null
      allResults: FlexMesoForAthleteResult[]
    }
  ): void
}>()

const selectedAthleteId = ref<string | null>(props.initialAthleteId)
const selectedType = ref<MesoType>(props.initialType ?? 'base')
const selectedDynamics = ref<MesoDynamics>(props.initialDynamics ?? 'ascending')
const weeksCount = ref<number>(clampWeeksCount(props.initialWeeksCount))
const sessionsPerWeek = ref<SessionCount[]>(
  buildSessionsPerWeek(weeksCount.value, props.initialSessionsPerWeek ?? undefined)
)

const athletesStore = useAthletesStore()
const { allAthletePlans } = storeToRefs(athletesStore)

const availableAthletes = computed<AthletePlanInput[]>(() =>
  Array.isArray(allAthletePlans.value) ? (allAthletePlans.value as AthletePlanInput[]) : []
)
watchEffect(() => {
  if (availableAthletes.value.length === 0) {
    selectedAthleteId.value = null
    return
  }

  const isSelectedAvailable = availableAthletes.value.some(
    (athlete) => athlete.athleteId === selectedAthleteId.value
  )
  if (!isSelectedAvailable) {
    selectedAthleteId.value = availableAthletes.value[0].athleteId
  }
})

watch(
  () => weeksCount.value,
  (nextCount) => {
    sessionsPerWeek.value = buildSessionsPerWeek(nextCount, sessionsPerWeek.value)
  }
)

const config = computed(() => ({
  type: selectedType.value,
  dynamics: selectedDynamics.value,
  sessionsPerWeek: [...sessionsPerWeek.value],
  variantId: props.variantId || undefined,
}))

const generatedForAll = computed<FlexMesoForAthleteResult[]>(() => {
  if (availableAthletes.value.length === 0) return []

  try {
    return createFlexMesoForAll(availableAthletes.value, config.value) as FlexMesoForAthleteResult[]
  } catch (error) {
    console.error('ShowMezoCycle: failed to generate meso cycles', error)
    return []
  }
})

const currentResultForAthlete = computed<FlexMesoForAthleteResult | null>(() => {
  if (generatedForAll.value.length === 0) return null

  if (!selectedAthleteId.value) return generatedForAll.value[0]

  return (
    generatedForAll.value.find((item) => item.athleteId === selectedAthleteId.value) ??
    generatedForAll.value[0]
  )
})

const currentMesoCycle = computed<MesoCycleResult | null>(
  () => currentResultForAthlete.value?.mesoCycle ?? null
)

const currentWeeks = computed<MesoWeekResult[]>(() =>
  Array.isArray(currentMesoCycle.value?.weeks) ? (currentMesoCycle.value?.weeks ?? []) : []
)

const currentWarnings = computed<string[]>(() => {
  const warnings = currentMesoCycle.value?.validation?.warnings
  if (!Array.isArray(warnings)) return []
  return warnings.map((warning) => String(warning))
})

const hasInputData = computed(() => availableAthletes.value.length > 0)

watch(
  [selectedAthleteId, selectedType, selectedDynamics, weeksCount, sessionsPerWeek],
  () => {
    emit('selection-change', {
      athleteId: selectedAthleteId.value,
      type: selectedType.value,
      dynamics: selectedDynamics.value,
      weeksCount: weeksCount.value,
      sessionsPerWeek: [...sessionsPerWeek.value],
      variantId: props.variantId,
    })
  },
  { immediate: true, deep: true }
)

watch(
  [currentResultForAthlete, currentMesoCycle, generatedForAll],
  () => {
    emit('result-change', {
      athleteId: selectedAthleteId.value,
      resultForAthlete: currentResultForAthlete.value,
      mesoCycle: currentMesoCycle.value,
      allResults: generatedForAll.value,
    })
  },
  { immediate: true }
)

const onWeeksInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  weeksCount.value = clampWeeksCount(Number(target.value))
}

const selectAthlete = (athleteId: string) => {
  selectedAthleteId.value = athleteId
}

const setWeekSessions = (weekIndex: number, count: SessionCount) => {
  const next = [...sessionsPerWeek.value]
  next[weekIndex] = count
  sessionsPerWeek.value = next
}

const getTypeLabel = (typeId: MesoType): string =>
  props.typeLabels[typeId] ?? DEFAULT_TYPE_LABELS[typeId]

const getDynamicsLabel = (dynamicsId: MesoDynamics): string =>
  props.dynamicsLabels[dynamicsId] ?? DEFAULT_DYNAMICS_LABELS[dynamicsId]

const athleteButtonClass = (athleteId: string): string => {
  if (selectedAthleteId.value === athleteId) return 'bg-slate-900 text-white border-slate-900'
  return 'bg-white text-slate-700 hover:bg-slate-50'
}

const typeButtonClass = (typeId: MesoType): string => {
  if (selectedType.value === typeId) return 'bg-slate-900 text-white border-slate-900'
  return 'bg-white text-slate-700 hover:bg-slate-50'
}

const dynamicsButtonClass = (dynamicsId: MesoDynamics): string => {
  if (selectedDynamics.value === dynamicsId) return 'bg-slate-900 text-white border-slate-900'
  return 'bg-white text-slate-700 hover:bg-slate-50'
}

const weekSessionButtonClass = (weekIndex: number, count: SessionCount): string => {
  if (sessionsPerWeek.value[weekIndex] === count) return 'bg-slate-900 text-white border-slate-900'
  return 'bg-white text-slate-700 hover:bg-slate-50'
}
</script>
