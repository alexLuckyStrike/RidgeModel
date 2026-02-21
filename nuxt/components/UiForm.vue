<template>
  <div :class="wrapperClass">
    <UiCard
      v-for="card in cards"
      :key="card.key"
      :title="card.title"
      :subtitle="card.subtitle"
    >
      <component :is="card.component" v-bind="card.componentProps" />
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import type { Component } from 'vue'

export type UiFormCard = {
  key: string
  title: string
  subtitle?: string
  component: Component
  componentProps?: Record<string, any>
}

const props = withDefaults(
  defineProps<{
    cards: UiFormCard[]
    wrapperClass?: string
  }>(),
  {
    wrapperClass: 'grid gap-4 md:grid-cols-2 xl:grid-cols-4 mobile-cards-vertical',
  },
)

const { cards, wrapperClass } = toRefs(props)
</script>
