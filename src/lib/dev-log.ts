export function devError(message: string, error?: unknown, ...details: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(message, error, ...details);
  }
}

export function devWarn(message: string, ...details: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(message, ...details);
  }
}
