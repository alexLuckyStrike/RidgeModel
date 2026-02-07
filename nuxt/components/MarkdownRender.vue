<template>
  <div class="prose prose-slate max-w-none" v-html="safeHtml" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const props = defineProps<{ markdown: string }>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

// Функция для стилизации формул и математических выражений
const enhanceFormulas = (html: string): string => {
  let enhanced = html
  
  // Выделяем переменные ΔV, ΔP, ΔR (до обработки блоков формул)
  enhanced = enhanced.replace(/(Δ[VPR])/g, '<span class="formula-var">$1</span>')
  
  // Выделяем коэффициенты b0, b1, b2, b3 и т.д.
  enhanced = enhanced.replace(/(\bb\d+\b)/g, '<span class="formula-coef">$1</span>')
  
  // Выделяем функции ln(...)
  enhanced = enhanced.replace(/(ln\([^)]+\))/g, '<span class="formula-func">$1</span>')
  
  // Оборачиваем параграфы с формулами в специальные блоки
  // Ищем параграфы, содержащие формулы вида "ln(...) = ..."
  enhanced = enhanced.replace(/<p>(<strong>)?([^<]*ln\([^)]+\)\s*=\s*[^<]+?)(<\/strong>)?<\/p>/g, (match, strong1, formula, strong2) => {
    const cleanFormula = formula.replace(/<\/?strong>/g, '').trim()
    return `<div class="formula-block">${cleanFormula}</div>`
  })
  
  return enhanced
}

const safeHtml = computed(() => {
  if (!props.markdown) return ''
  let raw = md.render(props.markdown)
  raw = enhanceFormulas(raw)
  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ['span', 'div'],
    ADD_ATTR: ['class'],
  })
})
</script>
