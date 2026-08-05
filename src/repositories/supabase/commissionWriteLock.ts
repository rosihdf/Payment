let writeChain: Promise<void> = Promise.resolve();

/** Serialisiert Supabase-Schreibzugriffe im Provisionsbereich gegen Browser-Deadlocks. */
export function runCommissionWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeChain.then(operation, operation);
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
