export default defineNuxtRouteMiddleware((to) => {
  if (!process.client) return
  if (to.path !== '/algorithm') return

  const unlocked = localStorage.getItem('algorithmUnlocked') === 'true'
  if (unlocked) return

  const { open } = useAlgorithmAuth()
  open('/algorithm')

  return abortNavigation()
})
