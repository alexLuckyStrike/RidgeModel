<template>
  <div class="grid gap-6 lg:grid-cols-3">
    <UiCard title="Динамика объёма" subtitle="V (кг) по всем тренировкам">
      <div v-if="!hasPlan" class="text-slate-600 text-sm">
        Сначала получите варианты тренировочного плана.
      </div>
      <div v-else class="relative h-64 max-h-64 w-full">
        <canvas ref="chartVEl" class="absolute inset-0 w-full h-full" />
      </div>
    </UiCard>

    <UiCard title="Динамика подъёмов" subtitle="P (раз) по всем тренировкам">
      <div v-if="!hasPlan" class="text-slate-600 text-sm">
        Сначала получите варианты тренировочного плана.
      </div>
      <div v-else class="relative h-64 max-h-64 w-full">
        <canvas ref="chartPEl" class="absolute inset-0 w-full h-full" />
      </div>
    </UiCard>

    <UiCard title="Динамика пауз" subtitle="R (мин) по всем тренировкам">
      <div v-if="!hasPlan" class="text-slate-600 text-sm">
        Сначала получите варианты тренировочного плана.
      </div>
      <div v-else class="relative h-64 max-h-64 w-full">
        <canvas ref="chartREl" class="absolute inset-0 w-full h-full" />
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import Chart from "chart.js/auto";
import UiCard from "~/components/UiCard.vue";
import type { PlannedSession } from "~/utils/plannerTypes";

const props = defineProps<{
  sessions: PlannedSession[];
  hasPlan: boolean;
}>();

const chartVEl = ref<HTMLCanvasElement | null>(null);
const chartPEl = ref<HTMLCanvasElement | null>(null);
const chartREl = ref<HTMLCanvasElement | null>(null);

let chartV: Chart | null = null;
let chartP: Chart | null = null;
let chartR: Chart | null = null;

const labels = computed(() => props.sessions.map((s) => `${s.week}.${s.session}`));
const V = computed(() => props.sessions.map((s) => s.V));
const P = computed(() => props.sessions.map((s) => s.P));
const R = computed(() => props.sessions.map((s) => s.R));

const destroyCharts = () => {
  if (chartV) chartV.destroy();
  if (chartP) chartP.destroy();
  if (chartR) chartR.destroy();
  chartV = chartP = chartR = null;
};

const drawCharts = async () => {
  if (!process.client) return;
  if (!props.hasPlan) {
    destroyCharts();
    return;
  }
  await nextTick();

  const makeChart = (
    el: HTMLCanvasElement | null,
    label: string,
    data: number[]
  ) => {
    if (!el) return null;
    return new Chart(el, {
      type: "line",
      data: {
        labels: labels.value,
        datasets: [{ label, data }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true },
        },
      },
    });
  };

  destroyCharts();
  chartV = makeChart(chartVEl.value, "V", V.value);
  chartP = makeChart(chartPEl.value, "P", P.value);
  chartR = makeChart(chartREl.value, "R", R.value);
};

const getPngDataUrls = () => ({
  V: chartVEl.value ? chartVEl.value.toDataURL("image/png", 1.0) : "",
  P: chartPEl.value ? chartPEl.value.toDataURL("image/png", 1.0) : "",
  R: chartREl.value ? chartREl.value.toDataURL("image/png", 1.0) : "",
});

defineExpose({
  drawCharts,
  destroyCharts,
  getPngDataUrls,
});

watch(
  () => [props.hasPlan, props.sessions.length],
  () => {
    drawCharts();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  destroyCharts();
});
</script>
