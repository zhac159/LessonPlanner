/**
 * Runs `worker` over `items`, the first one ALONE (its answer warms Claude's prompt cache for the rest, ai-pipeline
 * §4.6), then the others with at most `limit` in flight. A worker returns 'stop' to start no further items (the
 * ones already running finish). Never rejects: a worker that throws counts as 'stop'.
 */
export type PoolStep = 'continue' | 'stop'

export async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<PoolStep>
): Promise<void> {
  const queue = [...items]
  const safely = (item: T): Promise<PoolStep> => worker(item).catch((): PoolStep => 'stop')
  const first = queue.shift()
  if (first === undefined || (await safely(first)) === 'stop') return
  let stopped = false
  const lane = async (): Promise<void> => {
    while (!stopped && queue.length > 0) {
      const item = queue.shift() as T
      if ((await safely(item)) === 'stop') stopped = true
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, lane))
}
