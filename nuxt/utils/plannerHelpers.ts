import type { Row } from '~/stores/athletes'

/** Check if a Row has all V, P, R filled with valid numbers */
export const isFilled = (r: Row): boolean =>
  [r.V, r.P, r.R].every((x) => typeof x === 'number' && !Number.isNaN(x))

/** Build a row key from week and session numbers */
export const keyOf = (w: number, s: number): string => `${w}-${s}`

/** Generate a unique ID */
export const uid = (): string => {
  try {
    const c = globalThis.crypto as Crypto | undefined
    return c?.randomUUID
      ? c.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}
