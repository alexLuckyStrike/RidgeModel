<template>
  <div class="space-y-4">
    <p class="text-sm text-slate-600">
      Фото/текст описания нагрузки для каждого измерения.
    </p>

    <div class="space-y-4">
      <div
        v-for="(set, idx) in load5Sets"
        :key="set.id"
        class="rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div class="text-sm font-medium text-slate-900">Измерение {{ idx + 1 }}</div>

        <div class="mt-3 grid gap-3">
          <div class="space-y-2">
            <div class="text-xs font-medium text-slate-700">Фото тренировки</div>
            <label class="block">
              <input
                class="hidden"
                type="file"
                accept="image/*"
                @change="(e) => onSetFileChange(e, set.id, 'workoutPhoto')"
              />
              <div
                class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3 py-5 text-center transition hover:border-slate-400 hover:bg-slate-100"
              >
                <span class="text-sm font-medium text-slate-800">Загрузить фото</span>
                <span class="text-xs text-slate-500">Снимок плана/таблицы</span>
              </div>
            </label>
            <div v-if="set.workoutPhoto" class="relative overflow-hidden rounded-xl border border-slate-200">
              <img
                :src="set.workoutPhoto.url"
                :alt="set.workoutPhoto.name"
                class="h-28 w-full object-cover"
              />
              <button
                type="button"
                class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow"
                @click.stop="removeSetFile(set.id, 'workoutPhoto')"
              >
                <span class="sr-only">Удалить изображение</span>
                ×
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-medium text-slate-700">Текст нагрузки</div>
            <label class="block">
              <input
                class="hidden"
                type="file"
                accept="image/*,.txt"
                @change="(e) => onSetFileChange(e, set.id, 'workoutText')"
              />
              <div
                class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3 py-5 text-center transition hover:border-slate-400 hover:bg-slate-100"
              >
                <span class="text-sm font-medium text-slate-800">Загрузить файл</span>
                <span class="text-xs text-slate-500">Фото текста или .txt</span>
              </div>
            </label>
            <div v-if="set.workoutText" class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <div class="min-w-0">
                <div class="text-sm font-medium text-slate-800 truncate">{{ set.workoutText.name }}</div>
                <div class="text-xs text-slate-500">{{ Math.round(set.workoutText.size / 1024) }} КБ</div>
              </div>
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100"
                @click.stop="removeSetFile(set.id, 'workoutText')"
              >
                <span class="sr-only">Удалить файл</span>
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MvpLoad5Set } from "~/stores/mvp";

type Load5SetField = "first" | "second" | "workoutPhoto" | "workoutText";

defineProps<{
  load5Sets: MvpLoad5Set[];
  onSetFileChange: (event: Event, setId: string, field: Load5SetField) => void;
  removeSetFile: (setId: string, field: Load5SetField) => void;
}>();
</script>
