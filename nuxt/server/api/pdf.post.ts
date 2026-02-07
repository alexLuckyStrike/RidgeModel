export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const base = config.public.backendBase || 'http://localhost:3001'

  const res = await $fetch.raw<ArrayBuffer>(`${base}/pdf`, {
    method: 'POST',
    body,
    responseType: 'arrayBuffer',
  })

  setResponseHeader(event, 'content-type', res.headers.get('content-type') || 'application/pdf')
  setResponseHeader(
    event,
    'content-disposition',
    res.headers.get('content-disposition') || 'attachment; filename="training-plan.pdf"'
  )

  // Nitro will send the Buffer as binary
  return Buffer.from(res._data)
})
