<template>
  <div class="container">
    <div style="font-size:22px;font-weight:700;margin-bottom:6px">MVP 0.1 — Индикаторные полоски</div>
    <div style="opacity:.85;margin-bottom:16px;line-height:1.4">
      Загрузите шкалы ×2 и ×5, затем фото полосок (Покой / После нагрузки) и фото нагрузки/текста.
      Нажмите «Анализ» — вернётся результат.
    </div>

    <div class="card">
      <div style="font-weight:700;margin-bottom:10px">Эталоны (шкалы)</div>
      <div class="row">
        <DropZone title="Шкала ×2" hint="Фото шкалы для полоски с 2 зонами" :multiple="false" @update="f => scale2 = f" />
        <DropZone title="Шкала ×5" hint="Фото шкалы для полоски с 5 зонами" :multiple="false" @update="f => scale5 = f" />
      </div>
    </div>

    <div class="card">
      <div style="font-weight:700;margin-bottom:10px">Покой</div>
      <div class="row">
        <DropZone title="Покой — полоски ×2" hint="Фото индикаторных полосок (2 зоны)" @update="f => rest2 = f" />
        <DropZone title="Покой — полоски ×5" hint="Фото индикаторных полосок (5 зон)" @update="f => rest5 = f" />
      </div>
    </div>

    <div class="card">
      <div style="font-weight:700;margin-bottom:10px">После нагрузки</div>
      <div class="row">
        <DropZone title="Нагрузка — полоски ×2" hint="Фото индикаторных полосок (2 зоны)" @update="f => load2 = f" />
        <DropZone title="Нагрузка — полоски ×5" hint="Фото индикаторных полосок (5 зон)" @update="f => load5 = f" />
      </div>
    </div>

    <div class="card">
      <div style="font-weight:700;margin-bottom:10px">Нагрузка (контекст)</div>
      <div class="row">
        <DropZone title="Фото выполненной нагрузки" hint="Любые фото, где видно выполнение нагрузки" @update="f => workout = f" />
        <DropZone title="Фото с текстом (OCR)" hint="Фото, с которого нужно распознать текст" @update="f => text = f" />
      </div>
    </div>

    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0">
      <button class="btn" :disabled="busy" @click="analyze">{{ busy ? 'Анализ...' : 'Анализ' }}</button>
      <span v-if="sessionId" class="badge">Session: {{ sessionId }}</span>
      <span v-if="error" style="color:#ffb4b4">{{ error }}</span>
    </div>

    <div v-if="result" class="card">
      <div style="font-weight:700;margin-bottom:10px">Результат</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <span class="badge">rest: {{ (result.rest?.items || []).length }}</span>
        <span class="badge">load: {{ (result.load?.items || []).length }}</span>
        <span class="badge">ocr: {{ (result.ocr?.items || []).length }}</span>
      </div>

      <div style="display:grid;gap:16px">
        <ResultSection title="Покой" :data="result.rest" />
        <ResultSection title="После нагрузки" :data="result.load" />
        <ResultOCR :data="result.ocr" />
      </div>

      <details style="margin-top:14px">
        <summary style="cursor:pointer;opacity:.9">Показать JSON</summary>
        <pre style="white-space:pre-wrap;word-break:break-word;opacity:.9">{{ result }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import DropZone from './components/DropZone.vue';

const scale2 = ref([]);
const scale5 = ref([]);
const rest2 = ref([]);
const rest5 = ref([]);
const load2 = ref([]);
const load5 = ref([]);
const workout = ref([]);
const text = ref([]);

const sessionId = ref('');
const busy = ref(false);
const error = ref('');
const result = ref(null);

function appendFiles(fd, name, files) {
  (files || []).forEach(f => fd.append(name, f));
}

async function analyze() {
  error.value = '';
  result.value = null;
  busy.value = true;
  try {
    const fd = new FormData();
    appendFiles(fd, 'scale2', scale2.value);
    appendFiles(fd, 'scale5', scale5.value);
    appendFiles(fd, 'rest2', rest2.value);
    appendFiles(fd, 'rest5', rest5.value);
    appendFiles(fd, 'load2', load2.value);
    appendFiles(fd, 'load5', load5.value);
    appendFiles(fd, 'workout', workout.value);
    appendFiles(fd, 'text', text.value);

    const headers = {};
    if (sessionId.value) headers['x-session-id'] = sessionId.value;

    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers,
      body: fd
    });

    sessionId.value = resp.headers.get('x-session-id') || sessionId.value;

    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Analyze failed');
    result.value = json.result;
  } catch (e) {
    error.value = String(e?.message || e);
  } finally {
    busy.value = false;
  }
}

const ResultSection = {
  props: ['title', 'data'],
  template: `
    <div>
      <div style="font-weight:700;margin-bottom:8px">{{ title }}</div>
      <div v-if="!data || !data.items || !data.items.length" style="opacity:.8">Нет данных</div>
      <div v-for="item in data.items" :key="item.id" style="margin-bottom:10px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
          <span class="badge">{{ item.scale_type }}</span>
          <span class="badge">zones: {{ item.zones.length }}</span>
          <span style="opacity:.85;font-size:13px">{{ item.filename }}</span>
        </div>
        <table class="table" v-if="item.zones && item.zones.length">
          <thead>
            <tr>
              <th>Зона</th>
              <th>Средний LAB</th>
              <th>Ближайший уровень шкалы</th>
              <th>ΔE</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="z in item.zones" :key="z.index">
              <td>{{ z.index }}</td>
              <td>{{ z.mean_lab }}</td>
              <td>{{ z.nearest?.label }}</td>
              <td>{{ z.nearest?.delta_e }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
};

const ResultOCR = {
  props: ['data'],
  template: `
    <div>
      <div style="font-weight:700;margin-bottom:8px">OCR</div>
      <div v-if="!data || !data.items || !data.items.length" style="opacity:.8">Нет OCR-изображений</div>
      <div v-for="it in data.items" :key="it.id" style="margin-bottom:10px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
          <span class="badge">text</span>
          <span style="opacity:.85;font-size:13px">{{ it.filename }}</span>
        </div>
        <pre style="white-space:pre-wrap;word-break:break-word;opacity:.9;margin:0">{{ it.text || '' }}</pre>
        <div v-if="it.warning" style="opacity:.8;margin-top:6px">{{ it.warning }}</div>
      </div>
    </div>
  `
};
</script>
