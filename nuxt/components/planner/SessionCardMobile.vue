<template>
  <div class="rounded-2xl border p-4">
    <div class="flex items-center justify-between">
      <div class="font-medium">Тренировка {{ session }}</div>
      <span
        class="text-xs px-2 py-1 rounded-full"
        :class="chipClass"
      >{{ chipText }}</span>
    </div>
    <div class="mt-3 grid grid-cols-2 gap-3">
      <Field label="V (кг)">
        <input
          :value="row.V"
          type="number"
          class="input"
          @input="emit('update', 'V', toNum($event))"
        />
      </Field>
      <Field label="P (раз)">
        <input
          :value="row.P"
          type="number"
          class="input"
          @input="emit('update', 'P', toNum($event))"
        />
      </Field>
      <Field label="R (мин)">
        <input
          :value="row.R"
          type="number"
          step="0.1"
          class="input"
          @input="emit('update', 'R', toNum($event))"
        />
      </Field>
      <div class="rounded-xl bg-slate-50 border p-3">
        <div class="text-xs text-slate-600">Подсказка</div>
        <div class="text-sm text-slate-700 mt-1">
          P↑ = средний вес↓; P↓ = средний вес↑
        </div>
      </div>
    </div>
    <div class="mt-3 grid grid-cols-4 gap-3">
      <Field label="Креатинин">
        <input
          :value="row.creatinine"
          type="number"
          step="0.1"
          class="input"
          @input="emit('update', 'creatinine', toNum($event))"
        />
      </Field>
      <Field label="Белок">
        <input
          :value="row.protein"
          type="number"
          step="0.1"
          class="input"
          @input="emit('update', 'protein', toNum($event))"
        />
      </Field>
      <Field label="Миоглобин">
        <input
          :value="row.myoglobin"
          type="number"
          step="0.1"
          class="input"
          @input="emit('update', 'myoglobin', toNum($event))"
        />
      </Field>
      <Field label="Кетоны">
        <input
          :value="row.ketones"
          type="number"
          step="0.1"
          class="input"
          @input="emit('update', 'ketones', toNum($event))"
        />
      </Field>
    </div>
  </div>
</template>

<script setup lang="ts">
import Field from '~/components/UiField.vue'
import type { Row } from '~/stores/athletes'

defineProps<{
  session: number
  row: Row
  chipText: string
  chipClass: string
}>()

const emit = defineEmits<{
  (e: 'update', field: keyof Row, value: number | null): void
}>()

const toNum = (event: Event): number | null => {
  const val = (event.target as HTMLInputElement).valueAsNumber
  return Number.isNaN(val) ? null : val
}
</script>
