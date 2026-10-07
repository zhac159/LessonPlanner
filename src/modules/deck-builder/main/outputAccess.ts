/**
 * Which files the renderer may ask main to open or reveal. Never an arbitrary path: only a `.pptx` this
 * session exported, or a file a plugin saved in `lessons/<id>/outputs/`.
 */
import { relative, resolve, sep } from 'node:path'

/** True when `path` is `<dir>/lessons/<lessonId>/outputs/<file>` (no `..`, no deeper folders). */
export function isPluginOutput(dir: string, path: string): boolean {
  const parts = relative(resolve(dir, 'lessons'), resolve(path)).split(sep)
  return parts.length === 3 && parts[1] === 'outputs' && parts.every((p) => p !== '..' && p !== '')
}

/** The rule `openExport` and `showExport` apply. */
export function mayOpen(
  path: unknown,
  rules: { dir: string; wasExported(path: string): boolean }
): path is string {
  return typeof path === 'string' && (rules.wasExported(path) || isPluginOutput(rules.dir, path))
}
