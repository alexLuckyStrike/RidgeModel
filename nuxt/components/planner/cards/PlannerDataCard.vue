<template>
  <div class="text-sm text-slate-700">
    Заполните хотя бы 1 неделю — по средним значениям будет построена базовая
    нагрузка, от которой рассчитываются микроциклы.
  </div>
  <div class="mt-3 flex flex-col gap-2">
    <button
      class="h-10 px-3 rounded-xl bg-slate-100 text-slate-900 font-medium hover:bg-slate-200"
      @click="fillDemo"
    >
      Загрузить демоданные
    </button>
    <button
      class="h-10 px-3 rounded-xl border font-medium hover:bg-slate-50"
      @click="resetAll"
    >
      Сбросить ввод
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  fillDemo: () => void
  resetAll: () => void
}>()
</script>
