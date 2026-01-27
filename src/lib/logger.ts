type LogMeta = Record<string, unknown> | undefined;

export const logger = {
  info: (message: string, meta?: LogMeta) => {
    console.log(JSON.stringify({ level: 'info', message, timestamp: new Date(), ...meta }));
  },
  error: (message: string, error?: unknown, meta?: LogMeta) => {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        error: errorMessage,
        stack: errorStack,
        timestamp: new Date(),
        ...meta,
      })
    );
  },
  warn: (message: string, meta?: LogMeta) => {
    console.warn(JSON.stringify({ level: 'warn', message, timestamp: new Date(), ...meta }));
  },
};
