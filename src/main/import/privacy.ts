/**
 * Cheap local check for personal data in slide text (design/style-profile.md §2.2 "Privacy"): emails, phone
 * numbers and class-list style runs of "Firstname Surname" lines. It only warns; nothing is blocked.
 */
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE = /(?:\+44\s?|\b0)\d{3,4}[\s-]?\d{3}[\s-]?\d{3,4}\b/
const FULL_NAME = /^[A-Z][a-z’'-]+ [A-Z][a-z’'-]+$/
const NAME_LIST_MIN = 4

/** `texts` are blocks (one slide/page each); lines are split on newlines. */
export function looksLikePersonalData(texts: string[]): boolean {
  for (const text of texts) {
    if (EMAIL.test(text) || PHONE.test(text)) return true
    const names = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => FULL_NAME.test(line))
    if (names.length >= NAME_LIST_MIN) return true
  }
  return false
}
