
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MarkdownRender from '~/components/MarkdownRender.vue'

const content = ref('')
const loading = ref(true)
const error = ref(false)

onMounted(async () => {
  loading.value = true
  error.value = false
  try {
    const res = await fetch('http://localhost:3001/content/models')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    content.value = await res.text()
  } catch (e) {
    error.value = true
    console.error('Failed to load models content:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container-page">
    <h1 class="page-title">Модели микроциклов</h1>

    <div v-if="loading" class="text-slate-600 text-center py-8">
      Загрузка контента...
    </div>

    <div v-else-if="error" class="rounded-2xl border bg-rose-50 border-rose-100 p-6 text-rose-800">
      <p class="font-medium">Не удалось загрузить контент</p>
      <p class="text-sm mt-2">Проверьте, запущен ли backend сервер на порту 3001</p>
    </div>

    <div v-else class="markdown-content">
      <MarkdownRender :markdown="content" />
    </div>
  </div>
</template>

<style scoped>
.markdown-content {
  max-width: 900px;
  margin: 0 auto;
}
</style>
