<script setup lang="ts">
import { ref, computed } from 'vue'

const PASSWORD = 'Carter911'
const password = ref('')

const { show, pending, error, close, setError } = useAlgorithmAuth()
const canShow = computed(() => show.value === true)

async function submit() {
  if (!process.client) return
  if (password.value === PASSWORD) {
    localStorage.setItem('algorithmUnlocked', 'true')
    const target = pending.value || '/algorithm'
    password.value = ''
    close()
    await navigateTo(target)
  } else {
    setError('Неверный пароль')
    password.value = ''
    close()
    await navigateTo('/')
  }
}

async function cancel() {
  password.value = ''
  close()
  await navigateTo('/')
}
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="main">
      <NuxtPage />
    </main>
  </div>

  <div v-if="canShow" class="modal-backdrop" @click.self="cancel">
    <div class="modal">
      <h2>Доступ ограничен</h2>
      <p class="muted">Введите пароль для просмотра раздела «Алгоритм размышлений».</p>
      <input v-model="password" type="password" placeholder="Пароль" @keyup.enter="submit" />
      <div class="actions">
        <button class="btn primary" @click="submit">Войти</button>
        <button class="btn" @click="cancel">Отмена</button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
.main {
  padding: 0 24px 32px;
}
.modal-backdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 24px;
  z-index: 1000;
}
.modal{
  width: min(520px, 100%);
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.25);
}
.muted{ color:#666; margin: 6px 0 12px; }
.modal input{
  width:100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #ddd;
  outline: none;
}
.actions{ margin-top: 12px; display:flex; gap: 10px; }
.btn{
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
}
.btn.primary{
  background:#111;
  color:#fff;
  border-color:#111;
}
.error{ margin-top: 10px; color: #b00020; }
</style>
