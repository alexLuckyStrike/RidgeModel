<template>
  <div class="text-sm text-slate-700">
    Если есть проба в покое, модель строится для <b>Z = ln(Y / Y0)</b>, а прогноз
    возвращается как <b>Ŷ = Y0 · exp(Ẑ)</b>.
  </div>
  <div class="mt-3 grid grid-cols-4 gap-3">
    <UiField label="Креатинин Y0">
      <input v-model.number="activeRestBaseline.creatinine" type="number" step="0.1" class="input" />
    </UiField>
    <UiField label="Белок Y0">
      <input v-model.number="activeRestBaseline.protein" type="number" step="0.1" class="input" />
    </UiField>
    <UiField label="Миоглобин Y0">
      <input v-model.number="activeRestBaseline.myoglobin" type="number" step="0.1" class="input" />
    </UiField>
    <UiField label="Кетоны Y0">
      <input v-model.number="activeRestBaseline.ketones" type="number" step="0.1" class="input" />
    </UiField>
  </div>
  <div class="text-xs text-slate-600 mt-2">
    Если Y0 не заполнен, будет использована внутренняя подстановка (менее
    предпочтительно).
  </div>
</template>

<script setup lang="ts">
type RestBaseline = {
  creatinine: number | null
  protein: number | null
  myoglobin: number | null
  ketones: number | null
}

defineProps<{
  activeRestBaseline: RestBaseline
}>()
</script>
