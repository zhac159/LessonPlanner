/** Lower-cases, strips accents and collapses spaces, so "Café" matches "cafe" (03 §8 Search). */
export function normalise(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** True when `query` is empty or any of the fields contains it (case- and accent-insensitive). */
export function matchesQuery(
  query: string,
  fields: ReadonlyArray<string | null | undefined>
): boolean {
  const needle = normalise(query)
  if (!needle) return true
  return fields.some((field) => field != null && normalise(field).includes(needle))
}
