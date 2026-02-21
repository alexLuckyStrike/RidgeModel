<template>
  <div class="space-y-4">
    <p class="text-sm text-slate-600">
      Фотографии эталонных шкал для полосок.
    </p>

    <div class="space-y-4">
      <label class="block">
        <input
          class="hidden"
          type="file"
          accept="image/*"
          @change="(e) => onFileChange(e, 'scale2')"
        />
        <div
          class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center transition hover:border-slate-400 hover:bg-slate-100"
        >
          <span class="text-base font-medium text-slate-800">Шкала ×2</span>
          <span class="text-xs text-slate-500">Нажмите, чтобы выбрать фото</span>
        </div>
      </label>
      <div v-if="files.scale2" class="grid grid-cols-1 gap-3">
        <div class="relative overflow-hidden rounded-xl border border-slate-200">
          <img
            :src="files.scale2.url"
            :alt="files.scale2.name"
            class="h-32 w-full object-cover"
          />
          <button
            type="button"
            class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow"
            @click.stop="remove('scale2')"
          >
            <span class="sr-only">Удалить изображение</span>
            ×
          </button>
        </div>
      </div>

      <label class="block">
        <input
          class="hidden"
          type="file"
          accept="image/*"
          @change="(e) => onFileChange(e, 'scale5')"
        />
        <div
          class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center transition hover:border-slate-400 hover:bg-slate-100"
        >
          <span class="text-base font-medium text-slate-800">Шкала ×5</span>
          <span class="text-xs text-slate-500">Нажмите, чтобы выбрать фото</span>
        </div>
      </label>
      <div v-if="files.scale5" class="grid grid-cols-1 gap-3">
        <div class="relative overflow-hidden rounded-xl border border-slate-200">
          <img
            :src="files.scale5.url"
            :alt="files.scale5.name"
            class="h-32 w-full object-cover"
          />
          <button
            type="button"
            class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow"
            @click.stop="remove('scale5')"
          >
            <span class="sr-only">Удалить изображение</span>
            ×
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MvpKey } from "~/composables/usePlannerMvp";
import type { MvpPreview } from "~/stores/mvp";

defineProps<{
  files: {
    scale2: MvpPreview | null;
    scale5: MvpPreview | null;
    rest2: MvpPreview[];
  };
  onFileChange: (event: Event, key: MvpKey) => void;
  remove: (key: MvpKey, id?: string) => void;
}>();
</script>
