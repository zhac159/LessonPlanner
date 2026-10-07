/** Join class names, skipping falsy parts: `cx('a', active && 'b')`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
