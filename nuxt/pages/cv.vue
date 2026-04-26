<template>
  <div class="space-y-6">
    <section>
      <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight">
        MVP 0.1 — Индикаторные полоски
      </h1>
      <p class="text-slate-700 mt-2">
        Загрузите шкалы и фотографии полосок, затем запустите анализ.
      </p>
    </section>

    <UiCard title="Управление" subtitle="Демоданные и запуск анализа">
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="h-10 px-4 rounded-xl border text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          :disabled="mvpLoading || mvpDemoLoading"
          @click="loadMvpDemoData"
        >
          {{ mvpDemoLoading ? "Загрузка демо..." : "Загрузить демоданные" }}
        </button>
        <button
          type="button"
          class="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          :disabled="mvpLoading || !hasMvpFiles"
          @click="analyzeMvp"
        >
          {{ mvpLoading ? "Анализ..." : "Запустить анализ" }}
        </button>
      </div>
      <div v-if="mvpError" class="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ mvpError }}
      </div>
    </UiCard>

    <section class="grid gap-4 md:grid-cols-2">
      <UiCard title="Шкалы">
        <PlannerMvpScalesCard
          :files="mvpFiles"
          :on-file-change="handleMvpFileChange"
          :remove="removeMvpFile"
        />
      </UiCard>

      <UiCard title="Покой (полоски ×2)">
        <PlannerMvpRestCard
          :files="mvpFiles"
          :on-file-change="handleMvpFileChange"
          :remove="removeMvpFile"
        />
      </UiCard>

      <UiCard title="После нагрузки">
        <PlannerMvpAfterLoadCard
          :load5-sets="load5Sets"
          :add-set="addLoad5Set"
          :remove-set="removeLoad5Set"
          :on-set-file-change="handleLoad5SetFileChange"
          :remove-set-file="removeLoad5SetFile"
        />
      </UiCard>

      <UiCard title="Фото/текст тренировки">
        <PlannerMvpLoadCard
          :load5-sets="load5Sets"
          :on-set-file-change="handleLoad5SetFileChange"
          :remove-set-file="removeLoad5SetFile"
        />
      </UiCard>
    </section>

    <UiCard title="Результат анализа">
      <div v-if="!mvpResult" class="text-sm text-slate-600">
        Запустите анализ, чтобы увидеть результат.
      </div>
      <div v-else-if="mvpResult.status === 'error'" class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ mvpResult.message || mvpResult.error || 'Сервис вернул ошибку.' }}
      </div>
      <div v-else class="space-y-4">
        <div class="text-sm text-slate-700">
          Session: <span class="font-mono">{{ mvpResult.session_id || '—' }}</span>
        </div>

        <div v-if="mvpResult.medical_tests?.length" class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-slate-500 border-b">
                <th class="py-2 pr-3">Источник</th>
                <th class="py-2 pr-3">Фото</th>
                <th class="py-2 pr-3">Полоска</th>
                <th class="py-2 pr-3">Результаты</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, idx) in mvpResult.medical_tests"
                :key="`${item.source}-${item.photo_filename}-${idx}`"
                class="border-b align-top"
              >
                <td class="py-2 pr-3">{{ item.source }}</td>
                <td class="py-2 pr-3">{{ item.photo_filename }}</td>
                <td class="py-2 pr-3">{{ item.strip_index }}</td>
                <td class="py-2 pr-3">
                  <div
                    v-for="(value, key) in item.results"
                    :key="key"
                    class="font-mono text-xs"
                  >
                    {{ key }}: {{ value }} {{ item.units[key] || '' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="mvpResult.workout?.notes?.length">
          <div class="text-sm font-medium text-slate-800 mb-2">OCR заметки</div>
          <ul class="list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li v-for="(note, idx) in mvpResult.workout.notes" :key="idx">{{ note }}</li>
          </ul>
        </div>

        <details>
          <summary class="cursor-pointer text-sm text-slate-600">Показать JSON</summary>
          <pre class="mt-2 rounded-xl border bg-slate-50 p-3 text-xs overflow-auto">{{ prettyResult }}</pre>
        </details>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiCard from '~/components/UiCard.vue'
import PlannerMvpScalesCard from '~/components/planner/mvp/PlannerMvpScalesCard.vue'
import PlannerMvpRestCard from '~/components/planner/mvp/PlannerMvpRestCard.vue'
import PlannerMvpAfterLoadCard from '~/components/planner/mvp/PlannerMvpAfterLoadCard.vue'
import PlannerMvpLoadCard from '~/components/planner/mvp/PlannerMvpLoadCard.vue'
import { usePlannerMvp } from '~/composables/usePlannerMvp'

const uid = () => {
  try {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

const {
  mvpLoading,
  mvpDemoLoading,
  mvpError,
  mvpResult,
  mvpFiles,
  load5Sets,
  hasMvpFiles,
  handleMvpFileChange,
  removeMvpFile,
  analyzeMvp,
  loadMvpDemoData,
  addLoad5Set,
  removeLoad5Set,
  handleLoad5SetFileChange,
  removeLoad5SetFile,
} = usePlannerMvp(uid)

const prettyResult = computed(() =>
  mvpResult.value ? JSON.stringify(mvpResult.value, null, 2) : ''
)
</script>
