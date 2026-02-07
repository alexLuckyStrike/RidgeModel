<template>
  <label class="block">
    <div class="text-xs text-slate-600 mb-1">{{ label }}</div>
    <slot />
  </label>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>