<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle?: string
  password: string
}>()

const emit = defineEmits<{
  (e: 'unlocked'): void
}>()

const input = ref('')
const error = ref<string | null>(null)

function submit() {
  if (input.value === props.password) {
    error.value = null
    emit('unlocked')
    return
  }
  error.value = 'Неверный пароль'
}
</script>

<template>
  <div class="pw-overlay" role="dialog" aria-modal="true">
    <div class="pw-modal">
      <div class="pw-head">
        <div class="pw-title">{{ title }}</div>
        <div v-if="subtitle" class="pw-subtitle">{{ subtitle }}</div>
      </div>

      <div class="pw-body">
        <label class="pw-label">Пароль</label>
        <input
          v-model="input"
          class="pw-input"
          type="password"
          autocomplete="current-password"
          @keyup.enter="submit"
          placeholder="Введите пароль"
        />
        <div v-if="error" class="pw-error">{{ error }}</div>

        <div class="pw-actions">
          <button class="pw-btn" @click="submit">Открыть</button>
        </div>

        <div class="pw-hint">Подсказка: пароль задаётся в проекте (Carter911).</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pw-overlay{
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 16px;
  z-index: 9999;
}
.pw-modal{
  width: 100%;
  max-width: 520px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
  overflow: hidden;
}
.pw-head{
  padding: 18px 18px 0 18px;
}
.pw-title{
  font-size: 18px;
  font-weight: 700;
}
.pw-subtitle{
  margin-top: 6px;
  color: #475569;
  font-size: 13px;
}
.pw-body{
  padding: 18px;
}
.pw-label{
  display:block;
  font-size: 12px;
  color:#475569;
  margin-bottom: 6px;
}
.pw-input{
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  outline: none;
}
.pw-input:focus{
  border-color:#64748b;
}
.pw-actions{
  margin-top: 12px;
  display:flex;
  justify-content:flex-end;
}
.pw-btn{
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid #0f172a;
  background: #0f172a;
  color:#fff;
  font-weight: 600;
  cursor:pointer;
}
.pw-error{
  margin-top: 8px;
  color:#b91c1c;
  font-size: 13px;
}
.pw-hint{
  margin-top: 10px;
  font-size: 12px;
  color:#94a3b8;
}
</style>