<template>
  <tr class="border-t">
    <td class="py-3 pr-3 font-medium">{{ session }}</td>
    <td class="py-3 pr-3">
      <input
        :value="row.V"
        type="number"
        class="input h-10 w-28"
        @input="emit('update', 'V', toNum($event))"
      />
    </td>
    <td class="py-3 pr-3">
      <input
        :value="row.P"
        type="number"
        class="input h-10 w-24"
        @input="emit('update', 'P', toNum($event))"
      />
    </td>
    <td class="py-3 pr-3">
      <input
        :value="row.R"
        type="number"
        step="0.1"
        class="input h-10 w-24"
        @input="emit('update', 'R', toNum($event))"
      />
    </td>
    <td class="py-3 pr-3">
      <input
        :value="row.creatinine"
        type="number"
        step="0.1"
        class="input h-10 w-28"
        @input="emit('update', 'creatinine', toNum($event))"
      />
    </td>
    <td class="py-3 pr-3">
      <input
        :value="row.protein"
        type="number"
        step="0.1"
        class="input h-10 w-24"
        @input="emit('update', 'protein', toNum($event))"
      />
    </td>
    <td class="py-3 pr-3">
      <input
        :value="row.myoglobin"
        type="number"
        step="0.1"
        class="input h-10 w-28"
        @input="emit('update', 'myoglobin', toNum($event))"
      />
    </td>
    <td class="py-3 pr-3">
      <input
        :value="row.ketones"
        type="number"
        step="0.1"
        class="input h-10 w-24"
        @input="emit('update', 'ketones', toNum($event))"
      />
    </td>
    <td class="py-3">
      <span
        class="text-xs px-2 py-1 rounded-full"
        :class="chipClass"
      >{{ chipText }}</span>
    </td>
  </tr>
</template>

<script setup lang="ts">
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
