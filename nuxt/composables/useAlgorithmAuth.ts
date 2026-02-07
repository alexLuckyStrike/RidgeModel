export type PendingRoute = string | null

export const useAlgorithmAuth = () => {
  const show = useState<boolean>('algoAuthShow', () => false)
  const pending = useState<PendingRoute>('algoAuthPending', () => null)
  const error = useState<string>('algoAuthError', () => '')

  const open = (route: string) => {
    pending.value = route
    error.value = ''
    show.value = true
  }

  const close = () => {
    show.value = false
    error.value = ''
  }

  const setError = (msg: string) => {
    error.value = msg
  }

  return { show, pending, error, open, close, setError }
}
