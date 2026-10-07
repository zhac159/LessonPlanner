/**
 * Runtime name lists for contracts. An `...Api` interface only exists at compile time, but main
 * (registration checks), tests and tooling need the method and event names at runtime. `keysOf`
 * keeps the list and the interface in lock-step: leaving a key out, or adding an unknown one, is a
 * compile error.
 *
 *   export const FOO_METHODS = keysOf<FooApi>()(['get', 'set'])
 */

/** Keys of `T` that do not appear in the list `L`. */
type Missing<T, L extends readonly string[]> = Exclude<keyof T & string, L[number]>

/** Returns a function that accepts exactly the complete list of `T`'s string keys (any order). */
export function keysOf<T extends object>() {
  return <const L extends readonly (keyof T & string)[]>(
    names: L & ([Missing<T, L>] extends [never] ? unknown : never)
  ): L => names
}
