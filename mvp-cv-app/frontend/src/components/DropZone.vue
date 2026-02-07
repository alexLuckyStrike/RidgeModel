<template>
  <div
    class="zone"
    :class="{ drag: isDrag }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div>
      <div style="font-weight:700">{{ title }}</div>
      <div style="opacity:.8;font-size:13px;line-height:1.3;margin-top:2px">{{ hint }}</div>
    </div>

    <input
      ref="fileInput"
      type="file"
      :multiple="multiple"
      accept="image/*"
      style="display:none"
      @change="onPick"
    />

    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn" type="button" @click="pick">Выбрать фото</button>
      <span class="badge">Файлов: {{ files.length }}</span>
      <button v-if="files.length" class="btn" style="background:#394058" type="button" @click="clear">
        Очистить
      </button>
    </div>

    <div v-if="files.length" style="display:grid;grid-template-columns:1fr;gap:10px">
      <div v-for="f in files" :key="f.name" style="display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:center">
        <img class="thumb" :src="f.preview" alt="preview" />
        <div style="font-size:13px;opacity:.9;word-break:break-all">
          {{ f.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  hint: { type: String, default: '' },
  multiple: { type: Boolean, default: true }
});

const emit = defineEmits(['update']);

const isDrag = ref(false);
const fileInput = ref(null);

// internal representation with preview
const files = ref([]); // { file, name, preview }

function normalize(fileList) {
  const arr = Array.from(fileList || []);
  return arr.filter(f => f.type.startsWith('image/'));
}

function addFiles(newFiles) {
  const imgs = normalize(newFiles);
  const mapped = imgs.map(file => ({
    file,
    name: file.name,
    preview: URL.createObjectURL(file)
  }));
  files.value = props.multiple ? [...files.value, ...mapped] : (mapped.slice(0, 1));
  emit('update', files.value.map(x => x.file));
}

function onDragOver() { isDrag.value = true; }
function onDragLeave() { isDrag.value = false; }
function onDrop(e) {
  isDrag.value = false;
  addFiles(e.dataTransfer.files);
}

function pick() {
  if (fileInput.value) fileInput.value.click();
}

function onPick(e) {
  addFiles(e.target.files);
  // reset input so same file can be selected again
  e.target.value = '';
}

function clear() {
  for (const f of files.value) {
    try { URL.revokeObjectURL(f.preview); } catch {}
  }
  files.value = [];
  emit('update', []);
}

defineExpose({ clear });
</script>
