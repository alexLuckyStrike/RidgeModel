<template>
  <details
    class="rounded-2xl border bg-white p-4"
    :open="open"
  >
    <summary
      class="cursor-pointer select-none flex items-center justify-between gap-3"
    >
      <div class="font-semibold">Неделя {{ week }}</div>
      <div class="text-xs text-slate-600">
        {{ summary }}
      </div>
    </summary>

    <div class="mt-4 space-y-3">
      <!-- Mobile cards -->
      <div class="grid gap-3 lg:hidden">
        <SessionCardMobile
          v-for="s in sessionsPerWeek"
          :key="`${week}-${s}`"
          :session="s"
          :row="getRow(s)"
          :chip-text="getChipText(s)"
          :chip-class="getChipClass(s)"
          @update="(field, val) => $emit('update', week, s, field, val)"
        />
      </div>

      <!-- Desktop table -->
      <div class="hidden lg:block overflow-x-auto">
        <table class="w-full text-sm">
          <SessionTableHeader />
          <tbody>
            <SessionRowDesktop
              v-for="s in sessionsPerWeek"
              :key="`${week}-${s}`"
              :session="s"
              :row="getRow(s)"
              :chip-text="getChipText(s)"
              :chip-class="getChipClass(s)"
              @update="(field, val) => $emit('update', week, s, field, val)"
            />
          </tbody>
        </table>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import type { Row } from '~/stores/athletes'
import SessionCardMobile from '~/components/planner/SessionCardMobile.vue'
import SessionRowDesktop from '~/components/planner/SessionRowDesktop.vue'
import SessionTableHeader from '~/components/planner/SessionTableHeader.vue'

const props = defineProps<{
  week: number
  sessionsPerWeek: number
  open: boolean
  summary: string
  rows: Record<string, Row>
  chipText: (row: Row) => string
  chipClass: (row: Row) => string
  keyOf: (w: number, s: number) => string
}>()

defineEmits<{
  (e: 'update', week: number, session: number, field: keyof Row, value: number | null): void
}>()

const getRow = (s: number): Row => {
  const key = props.keyOf(props.week, s)
  return props.rows[key] ?? ({} as Row)
}

const getChipText = (s: number): string => props.chipText(getRow(s))
const getChipClass = (s: number): string => props.chipClass(getRow(s))
</script>
