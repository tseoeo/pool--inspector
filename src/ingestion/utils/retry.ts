interface RetryOptions {
  attempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  attempts: 3,
  delay: 1000,
  backoffMultiplier: 2,
  maxDelay: 30000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.delay;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.attempts) break;

      console.warn(
        `Attempt ${attempt} failed, retrying in ${delay}ms:`,
        lastError.message
      );
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}
