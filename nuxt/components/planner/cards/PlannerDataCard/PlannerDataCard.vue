<template>
  <div>
  <div class="text-sm text-slate-700">
    Данные загружаются только из базы данных.
  </div>
  <div class="mt-3 flex flex-col gap-2">
    <button
      class="h-10 px-3 rounded-xl bg-slate-100 text-slate-900 font-medium hover:bg-slate-200"
      @click="onFillDemo"
    >
      Обновить данные из БД
    </button>
    <button
      class="h-10 px-3 rounded-xl border font-medium hover:bg-slate-50"
      @click="props.resetAll"
    >
      Сбросить ввод
    </button>
  </div>
  </div>
</template>

<script setup lang="ts">
import { useRuntimeConfig } from 'nuxt/app'
import type { Athlete } from '../../../../stores/athletes'
import { fillDemo } from './fillDemo'


const props = defineProps<{
  applyLoadedAthletes: (athletes: Athlete[]) => void
  resetAll: () => void
}>()

const onFillDemo = async () => {
  const config = useRuntimeConfig()
  const backendBase =
    typeof config.public.backendBase === 'string' &&
    config.public.backendBase.trim()
      ? config.public.backendBase
      : 'http://localhost:3001'
  await fillDemo({
    backendBase,
    applyLoadedAthletes: props.applyLoadedAthletes,
  })
}

</script>
