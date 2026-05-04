interface CircuitState {
  failures: number
  openedAt: number | null
  firstFailureAt: number | null
}

const state = new Map<string, CircuitState>()
const THRESHOLD = 3
const TIMEOUT_MS = 30_000
const WINDOW_MS = 60_000

export function isOpen(name: string): boolean {
  const s = state.get(name)
  if (!s?.openedAt) return false
  if (Date.now() - s.openedAt > TIMEOUT_MS) {
    // half-open: allow one retry
    s.openedAt = null
    return false
  }
  return true
}

export function recordFailure(name: string): void {
  const s = state.get(name) ?? { failures: 0, openedAt: null, firstFailureAt: null }
  const now = Date.now()
  if (s.firstFailureAt !== null && now - s.firstFailureAt > WINDOW_MS) {
    s.failures = 0
    s.firstFailureAt = null
  }
  if (s.firstFailureAt === null) s.firstFailureAt = now
  s.failures++
  if (s.failures >= THRESHOLD) s.openedAt = now
  state.set(name, s)
}

export function recordSuccess(name: string): void {
  state.set(name, { failures: 0, openedAt: null, firstFailureAt: null })
}

export async function withBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  if (isOpen(name)) return fallback()
  try {
    const result = await fn()
    recordSuccess(name)
    return result
  } catch (err) {
    recordFailure(name)
    return fallback()
  }
}
