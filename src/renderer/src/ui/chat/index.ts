/** Chat kit (alias `@ui/chat`): the planning buddy's panel, messages and composer. Props-driven, no IPC. */
export { AttachmentCard, type AttachmentCardProps } from './AttachmentCard/AttachmentCard'
export { ChatPanel, type ChatPanelProps } from './ChatPanel/ChatPanel'
export { NEAR_BOTTOM_PX } from './ChatPanel/useStickToBottom'
export { Composer, MAX_ATTACHMENTS, type ComposerProps } from './Composer/Composer'
export { isSubmitKey, type ComposerKeyEvent } from './Composer/keys'
export { attachmentKindOf, fileTypeLabel, formatFileSize, type AttachmentKind } from './format'
export { MessageAssistant, type MessageAssistantProps } from './MessageAssistant/MessageAssistant'
export { parseRichText, type Block, type Inline } from './MessageAssistant/parseRichText'
export { MessageProgress, type MessageProgressProps } from './MessageProgress/MessageProgress'
export {
  MAX_VISIBLE_STEPS,
  visibleSteps,
  type ProgressStepItem,
  type StepState
} from './MessageProgress/steps'
export { MessageUser, type MessageUserProps } from './MessageUser/MessageUser'
export { RegionChip, type RegionChipProps } from './RegionChip/RegionChip'
export { ResultChip, UNDO_BLOCKED_HINT, type ResultChipProps } from './ResultChip/ResultChip'
