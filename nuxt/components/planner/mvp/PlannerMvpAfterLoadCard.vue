<template>
  <div class="space-y-4">
    <p class="text-sm text-slate-600">
      Полоски после нагрузки (одно изображение на измерение).
    </p>

    <div class="space-y-4">
      <div
        v-for="(set, idx) in load5Sets"
        :key="set.id"
        class="rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium text-slate-900">Измерение {{ idx + 1 }}</div>
          <button
            v-if="load5Sets.length > 1"
            type="button"
            class="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50"
            @click="removeSet(set.id)"
          >
            Удалить
          </button>
        </div>

        <div class="mt-3 grid gap-3">
          <div class="space-y-2">
            <div class="text-xs font-medium text-slate-700">После нагрузки</div>
            <label class="block">
              <input
                class="hidden"
                type="file"
                accept="image/*"
                @change="(e) => onSetFileChange(e, set.id, 'second')"
              />
              <div
                class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3 py-5 text-center transition hover:border-slate-400 hover:bg-slate-100"
              >
                <span class="text-sm font-medium text-slate-800">Загрузить фото</span>
                <span class="text-xs text-slate-500">Фото полоски после тренировки</span>
              </div>
            </label>
            <div v-if="set.second" class="relative overflow-hidden rounded-xl border border-slate-200">
              <img :src="set.second.url" :alt="set.second.name" class="h-24 w-full object-cover" />
              <button
                type="button"
                class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow"
                @click.stop="removeSetFile(set.id, 'second')"
              >
                <span class="sr-only">Удалить изображение</span>
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        @click="addSet"
      >
        + Добавить измерение
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MvpLoad5Set } from "~/stores/mvp";

type Load5SetField = "first" | "second" | "workoutPhoto" | "workoutText";

defineProps<{
  load5Sets: MvpLoad5Set[];
  addSet: () => void;
  removeSet: (setId: string) => void;
  onSetFileChange: (event: Event, setId: string, field: Load5SetField) => void;
  removeSetFile: (setId: string, field: Load5SetField) => void;
}>();
</script>
