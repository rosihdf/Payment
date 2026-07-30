export function isAbortError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return true;
    }
    if (/BILLING_OCR_ABORTED|aborted|abort/i.test(error.message)) {
      return true;
    }
  }
  return false;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

export async function raceWithAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export function normalizeAbortError(error: unknown): Error {
  if (isAbortError(error)) {
    const abortError = new Error('BILLING_OCR_ABORTED');
    abortError.name = 'AbortError';
    return abortError;
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

export function swallowAbortError(error: unknown): void {
  if (!isAbortError(error)) {
    throw error;
  }
}

export async function runAbortSafe<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  try {
    return await raceWithAbort(operation(), signal);
  } catch (error) {
    throw normalizeAbortError(error);
  }
}
