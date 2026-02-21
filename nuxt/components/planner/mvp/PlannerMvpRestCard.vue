<template>
  <div class="space-y-4">
    <p class="text-sm text-slate-600">
      Полоски с 2 зонами, снятые в состоянии покоя.
    </p>

    <label class="block">
      <input
        class="hidden"
        type="file"
        accept="image/*"
        multiple
        @change="(e) => onFileChange(e, 'rest2')"
      />
      <div
        class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center transition hover:border-slate-400 hover:bg-slate-100"
      >
        <span class="text-base font-medium text-slate-800">Добавить полоски ×2</span>
        <span class="text-xs text-slate-500">Можно выбрать несколько изображений</span>
      </div>
    </label>

    <p v-if="files.rest2.length" class="text-xs text-slate-500">
      Загружено: {{ files.rest2.length }}
    </p>

    <div v-if="files.rest2.length" class="grid grid-cols-2 gap-3">
      <div
        v-for="item in files.rest2"
        :key="item.id"
        class="relative overflow-hidden rounded-xl border border-slate-200"
      >
        <img :src="item.url" :alt="item.name" class="h-28 w-full object-cover" />
        <button
          type="button"
          class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow"
          @click.stop="remove('rest2', item.id)"
        >
          <span class="sr-only">Удалить изображение</span>
          ×
        </button>
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
