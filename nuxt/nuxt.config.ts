import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: false, // SPA mode
  css: ['~/assets/main.scss'],
  typescript: { strict: true },
  runtimeConfig: {
    public: {
      backendBase: process.env.BACKEND_BASE || 'http://localhost:3001',
    },
  },
  app: {
    head: {
      title: 'Powerlifting Load Model',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Моделирование тренировочного процесса на основе логарифмической регрессии и биомаркеров мочи.' },
      ],
    },
  },
})
