// Safe error helper: log full error server-side, return a generic message to the client.
// Usage: `return Response.json({ ok: false, error: safeError(err, 'simulation failed') }, ...)`

export function safeError(err: unknown, fallback: string): string {
  // Log the full error (and stack if available) for server-side diagnosis.
  if (err instanceof Error) {
    console.error('[walour]', err.message, err.stack)
  } else {
    console.error('[walour]', err)
  }
  return fallback
}
