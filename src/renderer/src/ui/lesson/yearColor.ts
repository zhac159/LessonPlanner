/**
 * CSS colour for a year-group tag ("Year 8", "Y8", "Form", "Sixth form"), from the `--year-*` tokens.
 * Unknown or missing tags fall back to the white surface so the chip still reads.
 */
export function yearColor(tag: string | null | undefined): string {
  const text = (tag ?? '').trim().toLowerCase()
  if (!text) return 'var(--white)'
  if (/form|tutor/.test(text) && !/sixth/.test(text)) return 'var(--year-form)'
  if (/sixth|\b(12|13)\b/.test(text)) return 'var(--year-sixth-form)'
  const year = /(?:year|yr|y)\s*(\d{1,2})\b/.exec(text) ?? /^(\d{1,2})$/.exec(text)
  const n = year ? Number(year[1]) : NaN
  if (n >= 7 && n <= 11) return `var(--year-${n})`
  if (n === 12 || n === 13) return 'var(--year-sixth-form)'
  return 'var(--white)'
}
