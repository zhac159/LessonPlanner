/** Runs async tasks one after another per key (here: per lesson), so two edits never interleave. */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>()

  /** Runs `task` after every earlier task for `key` has settled; a failing task does not block the next. */
  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve()
    const result = previous.then(task, task)
    const tail = result.catch(() => undefined)
    this.tails.set(key, tail)
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key)
    })
    return result
  }
}
