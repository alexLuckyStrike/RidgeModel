<template>
  <div class="space-y-4">
    <div class="rounded-2xl border bg-white p-4">
      <div class="text-xs font-medium text-slate-600">Тип микроцикла</div>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="typeId in typeOrder"
          :key="typeId"
          type="button"
          class="px-3 py-2 rounded-xl border text-sm transition"
          :class="typeButtonClass(typeId)"
          :disabled="!isTypeAvailable(typeId)"
          @click="selectType(typeId)"
        >
          {{ getTypeLabel(typeId) }}
        </button>
      </div>

      <div class="mt-4 text-xs font-medium text-slate-600">Количество сессий</div>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-for="count in sessionOrder"
          :key="count"
          type="button"
          class="px-3 py-2 rounded-xl border text-sm transition"
          :class="sessionButtonClass(count)"
          :disabled="!isSessionAvailable(count)"
          @click="selectSessions(count)"
        >
          {{ count }}
        </button>
      </div>
    </div>

    <ShowMicroCycleView
      :microcycle="currentVariant"
      :sessions="currentSessions"
      :selected-type="selectedType"
      :selected-sessions="selectedSessions"
      :selected-type-label="selectedTypeLabel"
      :variant-index="selectedVariantIndex"
      :variant-total="currentVariants.length"
      :can-navigate-variants="currentVariants.length > 1"
      @prev="goPrev"
      @next="goNext"
    >
      <template v-if="slots.default" #default="scope">
        <slot v-bind="scope" />
      </template>
      <template v-if="slots.session" #session="scope">
        <slot name="session" v-bind="scope" />
      </template>
    </ShowMicroCycleView>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useSlots, watch, watchEffect } from 'vue'
import ShowMicroCycleView from './ShowMicroCycleView.vue'

type MicrocycleType = 'recovery_intro' | 'base' | 'shock' | 'taper' | 'recovery'
type SessionCount = 3 | 4 | 5 | 6
type SessionCountKey = '3' | '4' | '5' | '6'

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
  metadata?: Record<string, unknown>
  validation?: Record<string, unknown>
}

type CatalogByLength = Partial<Record<SessionCountKey, MicrocycleVariant[]>>
type CatalogsByType = Partial<Record<MicrocycleType, CatalogByLength>>

const typeOrder: MicrocycleType[] = ['recovery_intro', 'base', 'shock', 'taper', 'recovery']
const sessionOrder: SessionCount[] = [3, 4, 5, 6]

const DEFAULT_TYPE_LABELS: Record<MicrocycleType, string> = {
  recovery_intro: 'Втягивающий',
  base: 'Базовый',
  shock: 'Ударный',
  taper: 'Подводящий',
  recovery: 'Восстановительный',
}

const props = withDefaults(
  defineProps<{
    catalogsByType: CatalogsByType
    initialType?: MicrocycleType | null
    initialSessions?: SessionCount | null
    initialVariantIndex?: number
    typeLabels?: Partial<Record<MicrocycleType, string>>
  }>(),
  {
    initialType: null,
    initialSessions: null,
    initialVariantIndex: 0,
    typeLabels: () => ({}),
  }
)

const emit = defineEmits<{
  (e: 'selection-change', payload: {
    selectedType: MicrocycleType | null
    selectedSessions: SessionCount | null
    selectedVariantIndex: number
    selectedVariantTotal: number
    microcycle: MicrocycleVariant | null
  }): void
}>()

const slots = useSlots()

const selectedType = ref<MicrocycleType | null>(props.initialType)
const selectedSessions = ref<SessionCount | null>(props.initialSessions)
const selectedVariantIndex = ref<number>(Math.max(0, props.initialVariantIndex))

const toSessionKey = (count: SessionCount): SessionCountKey => String(count) as SessionCountKey

const getTypeLabel = (typeId: MicrocycleType): string =>
  props.typeLabels[typeId] ?? DEFAULT_TYPE_LABELS[typeId]

const getVariants = (typeId: MicrocycleType | null, count: SessionCount | null): MicrocycleVariant[] => {
  if (!typeId || !count) return []
  const byLength = props.catalogsByType[typeId]
  if (!byLength) return []
  const list = byLength[toSessionKey(count)]
  return Array.isArray(list) ? list : []
}

const isTypeAvailable = (typeId: MicrocycleType): boolean => {
  const byLength = props.catalogsByType[typeId]
  if (!byLength) return false

  return sessionOrder.some((count) => {
    const list = byLength[toSessionKey(count)]
    return Array.isArray(list) && list.length > 0
  })
}

const isSessionAvailableForType = (typeId: MicrocycleType, count: SessionCount): boolean =>
  getVariants(typeId, count).length > 0

const isSessionAvailable = (count: SessionCount): boolean => {
  if (!selectedType.value) return false
  return isSessionAvailableForType(selectedType.value, count)
}

const availableTypes = computed(() => typeOrder.filter((typeId) => isTypeAvailable(typeId)))

const availableSessionsForSelectedType = computed(() => {
  if (!selectedType.value) return []
  return sessionOrder.filter((count) => isSessionAvailableForType(selectedType.value as MicrocycleType, count))
})

const currentVariants = computed(() => getVariants(selectedType.value, selectedSessions.value))

const currentVariant = computed<MicrocycleVariant | null>(() => {
  if (currentVariants.value.length === 0) return null
  return currentVariants.value[selectedVariantIndex.value] ?? null
})

const currentSessions = computed<MicrocycleSession[]>(() => currentVariant.value?.sessions ?? [])

const selectedTypeLabel = computed(() =>
  selectedType.value ? getTypeLabel(selectedType.value) : ''
)

const syncSelection = () => {
  if (availableTypes.value.length === 0) {
    selectedType.value = null
    selectedSessions.value = null
    selectedVariantIndex.value = 0
    return
  }

  if (!selectedType.value || !availableTypes.value.includes(selectedType.value)) {
    selectedType.value = availableTypes.value[0]
  }

  if (availableSessionsForSelectedType.value.length === 0) {
    selectedSessions.value = null
    selectedVariantIndex.value = 0
    return
  }

  if (
    !selectedSessions.value ||
    !availableSessionsForSelectedType.value.includes(selectedSessions.value)
  ) {
    selectedSessions.value = availableSessionsForSelectedType.value[0]
  }

  if (currentVariants.value.length === 0) {
    selectedVariantIndex.value = 0
    return
  }

  if (selectedVariantIndex.value < 0) selectedVariantIndex.value = 0
  if (selectedVariantIndex.value > currentVariants.value.length - 1) {
    selectedVariantIndex.value = currentVariants.value.length - 1
  }
}

watchEffect(syncSelection)

watch(
  [selectedType, selectedSessions, selectedVariantIndex, currentVariant, currentVariants],
  () => {
    emit('selection-change', {
      selectedType: selectedType.value,
      selectedSessions: selectedSessions.value,
      selectedVariantIndex: selectedVariantIndex.value,
      selectedVariantTotal: currentVariants.value.length,
      microcycle: currentVariant.value,
    })
  },
  { immediate: true }
)

const selectType = (typeId: MicrocycleType) => {
  if (!isTypeAvailable(typeId)) return
  selectedType.value = typeId
  selectedVariantIndex.value = 0
}

const selectSessions = (count: SessionCount) => {
  if (!isSessionAvailable(count)) return
  selectedSessions.value = count
  selectedVariantIndex.value = 0
}

const goNext = () => {
  const total = currentVariants.value.length
  if (total <= 1) return
  selectedVariantIndex.value = (selectedVariantIndex.value + 1) % total
}

const goPrev = () => {
  const total = currentVariants.value.length
  if (total <= 1) return
  selectedVariantIndex.value = (selectedVariantIndex.value - 1 + total) % total
}

const typeButtonClass = (typeId: MicrocycleType): string => {
  if (!isTypeAvailable(typeId)) return 'opacity-40 cursor-not-allowed hover:bg-white'
  if (selectedType.value === typeId) return 'bg-slate-900 text-white border-slate-900'
  return 'bg-white text-slate-700 hover:bg-slate-50'
}

const sessionButtonClass = (count: SessionCount): string => {
  if (!isSessionAvailable(count)) return 'opacity-40 cursor-not-allowed hover:bg-white'
  if (selectedSessions.value === count) return 'bg-slate-900 text-white border-slate-900'
  return 'bg-white text-slate-700 hover:bg-slate-50'
}
</script>
