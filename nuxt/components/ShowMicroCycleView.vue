<template>
  <div v-if="microcycle" class="rounded-2xl border bg-white">
    <div class="p-4 border-b">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs text-slate-500">
            <span class="font-medium">{{ selectedTypeLabel || 'Тип не выбран' }}</span>
            <span v-if="selectedSessions" class="ml-2">· {{ selectedSessions }} сессий</span>
          </div>
          <div class="mt-1 text-lg font-semibold text-slate-900">
            {{ microcycle.name }}
          </div>
          <div v-if="microcycle.context" class="mt-1 text-sm text-slate-600">
            {{ microcycle.context }}
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            class="h-9 w-9 rounded-lg border text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!canNavigateVariants"
            @click="$emit('prev')"
          >
            ‹
          </button>
          <div class="text-sm text-slate-700 min-w-14 text-center">
            {{ variantCounterText }}
          </div>
          <button
            type="button"
            class="h-9 w-9 rounded-lg border text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!canNavigateVariants"
            @click="$emit('next')"
          >
            ›
          </button>
        </div>
      </div>
    </div>

    <slot
      :microcycle="microcycle"
      :sessions="resolvedSessions"
      :selected-type="selectedType"
      :selected-sessions="selectedSessions"
      :selected-type-label="selectedTypeLabel"
      :variant-index="variantIndex"
      :variant-total="variantTotal"
    >
      <div class="p-4 space-y-4">
        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-xl border bg-slate-50 px-3 py-2">
            <div class="text-xs text-slate-500">Вариант</div>
            <div class="text-sm font-medium text-slate-900">
              {{ microcycle.variantId }}
            </div>
          </div>
          <div class="rounded-xl border bg-slate-50 px-3 py-2">
            <div class="text-xs text-slate-500">Средний PC1</div>
            <div class="text-sm font-medium text-slate-900">
              {{ formatNumber(microcycle.metadata?.averagePC1) }}
            </div>
          </div>
          <div class="rounded-xl border bg-slate-50 px-3 py-2">
            <div class="text-xs text-slate-500">Спирмен</div>
            <div class="text-sm font-medium text-slate-900">
              {{ formatNumber(microcycle.metadata?.spearman) }}
            </div>
          </div>
          <div class="rounded-xl border bg-slate-50 px-3 py-2">
            <div class="text-xs text-slate-500">Валидация</div>
            <div
              class="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs border"
              :class="validationClass"
            >
              {{ validationText }}
            </div>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <slot
            v-for="(session, idx) in resolvedSessions"
            :key="session.sessionIndex"
            name="session"
            :session="session"
            :session-index="idx"
            :total-sessions="resolvedSessions.length"
            :microcycle="microcycle"
          >
            <article class="rounded-2xl border p-3">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-slate-900">
                  Тренировка {{ session.sessionIndex + 1 }}
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs px-2 py-0.5 rounded-full border" :class="zoneClass(session.zone)">
                    Зона {{ session.zone }}
                  </span>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full border"
                    :class="realismClass(session.realism)"
                  >
                    {{ session.realism }}
                  </span>
                </div>
              </div>

              <div class="mt-2 text-sm text-slate-700">
                <div><b>Стратегия:</b> {{ session.strategy }}</div>
                <div><b>PC1:</b> {{ formatNumber(session.predictedPC1) }}</div>
                <div v-if="session.description"><b>Описание:</b> {{ session.description }}</div>
              </div>

              <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div class="rounded-lg bg-slate-50 border px-2 py-1">
                  <div class="text-slate-500">V</div>
                  <div class="font-medium text-slate-900">
                    {{ formatNumber(session.absoluteLoad?.V) }}
                  </div>
                </div>
                <div class="rounded-lg bg-slate-50 border px-2 py-1">
                  <div class="text-slate-500">P</div>
                  <div class="font-medium text-slate-900">
                    {{ formatNumber(session.absoluteLoad?.P) }}
                  </div>
                </div>
                <div class="rounded-lg bg-slate-50 border px-2 py-1">
                  <div class="text-slate-500">R</div>
                  <div class="font-medium text-slate-900">
                    {{ formatNumber(session.absoluteLoad?.R) }}
                  </div>
                </div>
              </div>

              <div class="mt-2 text-xs text-slate-600">
                ΔV {{ formatPercent(session.deltas.dV) }} ·
                ΔP {{ formatPercent(session.deltas.dP) }} ·
                ΔR {{ formatPercent(session.deltas.dR) }}
              </div>
            </article>
          </slot>
        </div>
      </div>
    </slot>
  </div>

  <div v-else class="rounded-2xl border bg-white p-5 text-sm text-slate-600">
    Для выбранных параметров нет доступных микроциклов.
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type MicrocycleType = 'recovery_intro' | 'base' | 'shock' | 'taper' | 'recovery'
type SessionCount = 3 | 4 | 5 | 6

type RealismStatus = 'good' | 'caution' | 'avoid' | string

interface MicrocycleSession {
  sessionIndex: number
  zone: number
  strategy: string
  predictedPC1: number
  realism: RealismStatus
  deltas: {
    dV: number
    dP: number
    dR: number
  }
  absoluteLoad?: {
    V: number
    P: number
    R: number
  }
  description?: string
}

interface MicrocycleVariant {
  variantId: string
  name: string
  context?: string
  type?: string
  sessions: MicrocycleSession[]
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
}

const props = withDefaults(
  defineProps<{
    microcycle: MicrocycleVariant | null
    sessions?: MicrocycleSession[] | null
    selectedType: MicrocycleType | null
    selectedSessions: SessionCount | null
    selectedTypeLabel?: string
    variantIndex: number
    variantTotal: number
    canNavigateVariants?: boolean
  }>(),
  {
    sessions: null,
    selectedTypeLabel: '',
    canNavigateVariants: false,
  }
)

defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
}>()

const resolvedSessions = computed(() => props.sessions ?? props.microcycle?.sessions ?? [])

const variantCounterText = computed(() => {
  if (props.variantTotal <= 0) return '0 / 0'
  return `${props.variantIndex + 1} / ${props.variantTotal}`
})

const validationText = computed(() => {
  if (!props.microcycle?.validation) return 'Нет данных'
  return props.microcycle.validation.valid ? 'valid' : 'invalid'
})

const validationClass = computed(() => {
  if (!props.microcycle?.validation) return 'border-slate-200 bg-slate-50 text-slate-700'
  return props.microcycle.validation.valid
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-rose-200 bg-rose-50 text-rose-800'
})

const formatNumber = (value: unknown): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

const formatPercent = (value: number): string => {
  const percent = value * 100
  const sign = percent > 0 ? '+' : ''
  return `${sign}${percent.toFixed(1)}%`
}

const zoneClass = (zone: number): string => {
  if (zone === 1) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (zone === 2) return 'border-sky-200 bg-sky-50 text-sky-800'
  if (zone === 3) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-rose-200 bg-rose-50 text-rose-800'
}

const realismClass = (status: RealismStatus): string => {
  if (status === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === 'caution') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-rose-200 bg-rose-50 text-rose-800'
}
</script>
