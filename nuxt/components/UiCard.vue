<template>
  <div class="rounded-2xl border bg-white shadow-soft">
    <div v-if="title" class="px-5 pt-5">
      <div class="text-base font-semibold">{{ title }}</div>
      <div v-if="subtitle" class="text-sm text-slate-600 mt-1">{{ subtitle }}</div>
    </div>
    <div class="p-5">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string }>()
</script>