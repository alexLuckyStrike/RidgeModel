<template>
  <div class="space-y-4">
    <div class="rounded-2xl border bg-white p-4">
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

      <div class="mt-4 text-xs font-medium text-slate-600">Тип микроцикла</div>
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
    {{ buildAthletesFromTypeObject }}
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
import { useAthletesStore } from '~/stores/athletes'

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

interface AthleteMicrocycleCatalog {
  athleteId: string
  name: string
  catalogsByType: CatalogsByType
}

interface TypeCatalogRow {
  athleteId: string
  name: string
  catalog: CatalogByLength
}

type CatalogsForAllAthletesByType = Partial<Record<MicrocycleType, TypeCatalogRow[]>>

const typeOrder: MicrocycleType[] = ['recovery_intro', 'base', 'shock', 'taper', 'recovery']
const sessionOrder: SessionCount[] = [3, 4, 5, 6]

const DEFAULT_TYPE_LABELS: Record<MicrocycleType, string> = {
  recovery_intro: 'Втягивающий',
  base: 'Базовый',
  shock: 'Ударный',
  taper: 'Подводящий',
  recovery: 'Восстановительный',
}

const DEFAULT_STUB_CATALOGS: CatalogsByType = {
  base: {
    '3': [
      {
        variantId: 'stub-v1',
        name: 'Заглушка микроцикла',
        context: 'Компонент запущен без данных каталога. Передайте реальные данные из store.',
        type: 'base',
        sessions: [
          {
            sessionIndex: 0,
            zone: 2,
            strategy: 'balanced',
            predictedPC1: -0.66,
            realism: 'good',
            deltas: { dV: -0.04, dP: -0.04, dR: 0 },
            absoluteLoad: { V: 8000, P: 72, R: 3.7 },
            description: 'V -4.0%, P -4.0%',
          },
          {
            sessionIndex: 1,
            zone: 3,
            strategy: 'volume_only',
            predictedPC1: 1.04,
            realism: 'caution',
            deltas: { dV: 0.14, dP: 0, dR: 0 },
            absoluteLoad: { V: 9500, P: 75, R: 3.7 },
            description: 'V +14.0%',
          },
          {
            sessionIndex: 2,
            zone: 2,
            strategy: 'variative',
            predictedPC1: -0.66,
            realism: 'good',
            deltas: { dV: -0.03, dP: -0.03, dR: 0.06 },
            absoluteLoad: { V: 8120, P: 73, R: 3.9 },
            description: 'V -3.0%, P -3.0%, R +6.0%',
          },
        ],
        metadata: {
          averagePC1: -0.09,
          spearman: 0.13,
        },
        validation: {
          valid: false,
          warnings: ['Заглушка: подключите реальные данные из store'],
        },
      },
    ],
  },
}

const DEFAULT_STUB_ATHLETES: AthleteMicrocycleCatalog[] = [
  {
    athleteId: 'stub-athlete',
    name: 'Спортсмен (заглушка)',
    catalogsByType: DEFAULT_STUB_CATALOGS,
  },
]

const props = withDefaults(
  defineProps<{
    athletesCatalogs?: AthleteMicrocycleCatalog[] | null
    allCatalogsByType?: CatalogsForAllAthletesByType | null
    catalogsByType?: CatalogsByType | null
    initialAthleteId?: string | null
    initialType?: MicrocycleType | null
    initialSessions?: SessionCount | null
    initialVariantIndex?: number
    typeLabels?: Partial<Record<MicrocycleType, string>>
  }>(),
  {
    athletesCatalogs: null,
    allCatalogsByType: null,
    catalogsByType: null,
    initialAthleteId: null,
    initialType: null,
    initialSessions: null,
    initialVariantIndex: 0,
    typeLabels: () => ({}),
  }
)

const emit = defineEmits<{
  (
    e: 'selection-change',
    payload: {
      selectedAthleteId: string | null
      selectedAthleteName: string | null
      selectedType: MicrocycleType | null
      selectedSessions: SessionCount | null
      selectedVariantIndex: number
      selectedVariantTotal: number
      microcycle: MicrocycleVariant | null
    }
  ): void
}>()

const slots = useSlots()
const athletesStore = useAthletesStore()
const storeCatalogsByType = computed<CatalogsForAllAthletesByType | null>(
  () => (athletesStore.allCatalogsByType as CatalogsForAllAthletesByType | null) ?? null
)

const selectedAthleteId = ref<string | null>(props.initialAthleteId)
const selectedType = ref<MicrocycleType | null>(props.initialType)
const selectedSessions = ref<SessionCount | null>(props.initialSessions)
const selectedVariantIndex = ref<number>(Math.max(0, props.initialVariantIndex))

const toSessionKey = (count: SessionCount): SessionCountKey => String(count) as SessionCountKey

const getTypeLabel = (typeId: MicrocycleType): string =>
  props.typeLabels[typeId] ?? DEFAULT_TYPE_LABELS[typeId]

const buildAthletesFromTypeObject = (
  input: CatalogsForAllAthletesByType | null | undefined
): AthleteMicrocycleCatalog[] => {
  if (!input) return []

  const byAthleteId = new Map<string, AthleteMicrocycleCatalog>()

  for (const typeId of typeOrder) {
    const rows = input[typeId]
    if (!Array.isArray(rows)) continue

    for (const row of rows) {
      if (!row || !row.athleteId) continue

      const current = byAthleteId.get(row.athleteId)
      if (!current) {
        byAthleteId.set(row.athleteId, {
          athleteId: row.athleteId,
          name: row.name || row.athleteId,
          catalogsByType: {
            [typeId]: row.catalog ?? {},
          },
        })
        continue
      }

      current.catalogsByType[typeId] = row.catalog ?? {}
      if (!current.name && row.name) current.name = row.name
    }
  }

  return Array.from(byAthleteId.values())
}

const normalizedAthletes = computed<AthleteMicrocycleCatalog[]>(() => {
  if (Array.isArray(props.athletesCatalogs) && props.athletesCatalogs.length > 0) {
    return props.athletesCatalogs
  }

  const merged = buildAthletesFromTypeObject(props.allCatalogsByType)
  if (merged.length > 0) return merged

  const mergedFromStore = buildAthletesFromTypeObject(storeCatalogsByType.value)
  if (mergedFromStore.length > 0) return mergedFromStore

  if (props.catalogsByType) {
    return [
      {
        athleteId: 'single-athlete',
        name: 'Спортсмен',
        catalogsByType: props.catalogsByType,
      },
    ]
  }

  return DEFAULT_STUB_ATHLETES
})

const availableAthletes = computed(() => normalizedAthletes.value)

const selectedAthlete = computed<AthleteMicrocycleCatalog | null>(() => {
  if (availableAthletes.value.length === 0) return null
  if (!selectedAthleteId.value) return availableAthletes.value[0]

  return (
    availableAthletes.value.find((a) => a.athleteId === selectedAthleteId.value) ??
    availableAthletes.value[0]
  )
})

const selectedAthleteName = computed<string | null>(() => selectedAthlete.value?.name ?? null)

const resolvedCatalogsByType = computed<CatalogsByType>(
  () => selectedAthlete.value?.catalogsByType ?? DEFAULT_STUB_CATALOGS
)

const getVariants = (
  typeId: MicrocycleType | null,
  count: SessionCount | null
): MicrocycleVariant[] => {
  if (!typeId || !count) return []
  const byLength = resolvedCatalogsByType.value[typeId]
  if (!byLength) return []
  const list = byLength[toSessionKey(count)]
  return Array.isArray(list) ? list : []
}

const isTypeAvailable = (typeId: MicrocycleType): boolean => {
  const byLength = resolvedCatalogsByType.value[typeId]
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
  return sessionOrder.filter((count) =>
    isSessionAvailableForType(selectedType.value as MicrocycleType, count)
  )
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
  if (availableAthletes.value.length === 0) {
    selectedAthleteId.value = null
    selectedType.value = null
    selectedSessions.value = null
    selectedVariantIndex.value = 0
    return
  }

  if (
    !selectedAthleteId.value ||
    !availableAthletes.value.some((athlete) => athlete.athleteId === selectedAthleteId.value)
  ) {
    selectedAthleteId.value = availableAthletes.value[0].athleteId
  }

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
  [
    selectedAthleteId,
    selectedAthleteName,
    selectedType,
    selectedSessions,
    selectedVariantIndex,
    currentVariant,
    currentVariants,
  ],
  () => {
    emit('selection-change', {
      selectedAthleteId: selectedAthleteId.value,
      selectedAthleteName: selectedAthleteName.value,
      selectedType: selectedType.value,
      selectedSessions: selectedSessions.value,
      selectedVariantIndex: selectedVariantIndex.value,
      selectedVariantTotal: currentVariants.value.length,
      microcycle: currentVariant.value,
    })
  },
  { immediate: true }
)

const selectAthlete = (athleteId: string) => {
  if (selectedAthleteId.value === athleteId) return
  selectedAthleteId.value = athleteId
  selectedVariantIndex.value = 0
}

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

const athleteButtonClass = (athleteId: string): string => {
  if (selectedAthleteId.value === athleteId) return 'bg-slate-900 text-white border-slate-900'
  return 'bg-white text-slate-700 hover:bg-slate-50'
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
