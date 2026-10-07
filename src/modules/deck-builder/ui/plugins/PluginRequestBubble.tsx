import { pluginIcon } from '@ui/plugin'
import type { PluginRequest } from '../chat/transcriptState'
import './PluginRequestBubble.css'

export interface PluginRequestBubbleProps {
  request: Pick<PluginRequest, 'title' | 'icon' | 'tint' | 'summary'>
}

/** What she asked a plugin for, shown in the chat like one of her messages (07 §5). */
export function PluginRequestBubble({ request }: PluginRequestBubbleProps) {
  const Icon = pluginIcon(request.icon)
  return (
    <div className="plugin-request" role="group" aria-label={request.title}>
      <span className="plugin-request__tile" data-tone={request.tint} aria-hidden="true">
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <span className="plugin-request__text">
        <span className="plugin-request__title">{request.title}</span>
        {request.summary && <span className="plugin-request__summary">{request.summary}</span>}
      </span>
    </div>
  )
}
