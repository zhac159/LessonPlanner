/** Public API of the lessons services (the rest of this folder is internal). */
export { LessonsService } from './service'
export type { ChangeInput, Edited } from './editor'
export type { FoundDocument } from './lessonFiles'
export type { Job } from './jobs'
export type { LessonListItem } from './summary'
export {
  silentLogger,
  type DialogPort,
  type EmitEvent,
  type GenerationRecord,
  type LessonsServiceDeps,
  type NewLesson,
  type OpenedLesson,
  type Logger,
  type SlideRenderRequest,
  type SlideRendererPort,
  type StyleSource,
  type TrashPort
} from './types'
