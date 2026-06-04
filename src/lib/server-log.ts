export function serverError(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(...args);
    return;
  }

  if (args.length === 0) {
    return;
  }

  const [message] = args;
  console.error(message);
}
