
<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
const isActive = (path) => route.path === path
const sidebarOpen = ref(false)
const closeSidebar = () => { sidebarOpen.value = false }
</script>

<template>
  <header class="header">
    <div class="logo">
      <strong>Модель управления нагрузкой:</strong>
      <span class="subtitle">логарифмическая регрессия · биомаркеры мочи</span>
    </div>
    <!-- burger button (mobile only) -->
    <button class="burger" @click="sidebarOpen = true" aria-label="Открыть меню">
      <span/>
      <span/>
      <span/>
    </button>
    <!-- desktop nav -->
    <nav class="nav">
      <NuxtLink to="/" class="nav-btn" :class="{ active: isActive('/') }">Идея</NuxtLink>
      <NuxtLink to="/markers" class="nav-btn" :class="{ active: isActive('/markers') }">Маркеры</NuxtLink>
      <NuxtLink to="/models" class="nav-btn" :class="{ active: isActive('/models') }">Модели микроциклов</NuxtLink>
      <NuxtLink to="/regression" class="nav-btn" :class="{ active: isActive('/regression') }">Регрессия</NuxtLink>
      <NuxtLink to="/algorithm" class="nav-btn" :class="{ active: isActive('/algorithm') }">Алгоритм</NuxtLink>
      <NuxtLink to="/planner" class="nav-btn" :class="{ active: isActive('/planner') }">Моделирование</NuxtLink>
    </nav>
    <!-- sidebar (mobile) -->
    <transition name="sidebar-fade">
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="closeSidebar">
        <nav class="sidebar" @click.stop>
          <button class="close-btn" @click="closeSidebar" aria-label="Закрыть меню">×</button>
          <NuxtLink to="/" class="sidebar-link" :class="{ active: isActive('/') }" @click="closeSidebar">Идея</NuxtLink>
          <NuxtLink to="/markers" class="sidebar-link" :class="{ active: isActive('/markers') }" @click="closeSidebar">Маркеры</NuxtLink>
          <NuxtLink to="/models" class="sidebar-link" :class="{ active: isActive('/models') }" @click="closeSidebar">Модели микроциклов</NuxtLink>
          <NuxtLink to="/regression" class="sidebar-link" :class="{ active: isActive('/regression') }" @click="closeSidebar">Регрессия</NuxtLink>
          <NuxtLink to="/algorithm" class="sidebar-link" :class="{ active: isActive('/algorithm') }" @click="closeSidebar">Алгоритм</NuxtLink>
          <NuxtLink to="/planner" class="sidebar-link" :class="{ active: isActive('/planner') }" @click="closeSidebar">Моделирование</NuxtLink>
        </nav>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  flex-wrap: wrap;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}
@media (min-width: 600px) {
  .header {
    padding: 1.5rem 2vw;
  }
}
@media (min-width: 600px) {
  .header {
  padding: 16px 24px;
  }
}
.logo {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.subtitle {
  font-size: 12px;
  color: #666;
  white-space: pre-line;
  word-break: break-word;
  line-height: 1.2;
}
.subtitle {
  font-size: 12px;
  color: #666;
}
.nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
  padding-bottom: 0.25rem;
  overscroll-behavior-x: contain;
}
@media (min-width: 600px) {
  .nav { gap: 0.75rem; }
}
@media (min-width: 600px) {
  .nav { gap: 12px; }
}
.nav-btn {
  padding: 0.35em 0.9em;
  border-radius: 0.625em;
  text-decoration: none;
  color: #333;
  font-size: 1em;
  white-space: nowrap;
  min-width: 0;
}
@media (min-width: 600px) {
  .nav-btn {
    padding: 6px 12px;
    font-size: 16px;
  }
}
.nav-btn.active {
  background: #111;
  color: white;
}
/* Бургер-кнопка */
.burger {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 2.25rem;
  height: 2.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  gap: 0.25em;
  z-index: 120;
}
.burger span {
  width: 1.7em;
  height: 3px;
  background: #222;
  border-radius: 2px;
  transition: all 0.25s;
  display: block;
}
@media (min-width: 900px) {
  .burger { display: none; }
}

/* Desktop nav */
.nav {
  /* ...оставь прочие стили... */
}
@media (max-width: 899px) {
  .nav { display: none; }
}
@media (min-width: 900px) {
  .nav { display: flex; }
}

/* Мобильное меню сайдбар */
.sidebar-overlay {
  position: fixed;
  z-index: 100;
  inset: 0;
  background: rgba(0,0,0,0.24);
  display: flex;
  justify-content: flex-end;
  transition: background 0.25s;
}
.sidebar {
  background: white;
  width: 80vw;
  max-width: 320px;
  min-width: 170px;
  height: 100vh;
  padding: 2rem 1.5rem 1.5rem 1.5rem;
  box-shadow: -1px 0 10px #0002;
  display: flex;
  flex-direction: column;
  gap: 1.15em;
  position: relative;
}
.sidebar-link {
  color: #222;
  text-decoration: none;
  font-size: 1.13em;
  padding: 7px 0 7px 0.2em;
  border-radius: 6px;
  transition: background .15s;
  font-weight: 500;
}
.sidebar-link.active, .sidebar-link:hover {
  background: #f4f4f4;
}
.close-btn {
  all: unset;
  cursor: pointer;
  position: absolute;
  right: 1.2rem;
  top: 1.3rem;
  font-size: 2rem;
  font-weight: 400;
  line-height: 1;
  color: #888;
}
@media (min-width: 900px) {
  .sidebar-overlay { display: none !important; }
}

.sidebar-fade-enter-active,
.sidebar-fade-leave-active {
  transition: opacity 0.23s cubic-bezier(.4,0,.2,1);
}
.sidebar-fade-enter-from,
.sidebar-fade-leave-to { opacity: 0; }

</style>
