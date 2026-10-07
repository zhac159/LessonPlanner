import { X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { cx } from '../../atoms/cx'
import { MAX_TAGS, MAX_TAG_LENGTH, addTag, normaliseTag, removeTag } from './tags'
import './TagEditor.css'

export interface TagEditorProps {
  tags: readonly string[]
  onChange: (tags: string[]) => void
  className?: string
}

/** "Tags" row: pills with ×, and a dashed "+ Tag" field (Enter or a comma adds; at most 12). */
export function TagEditor({ tags, onChange, className }: TagEditorProps) {
  const [draft, setDraft] = useState('')

  const commit = (text: string): void => {
    const next = addTag(tags, text)
    if (next !== tags) onChange([...next])
    setDraft('')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Escape') {
      setDraft('')
    }
  }

  return (
    <div className={cx('as-tags', className)} role="group" aria-label="Tags">
      <span className="as-tags__label" aria-hidden="true">
        Tags
      </span>
      <ul className="as-tags__list">
        {tags.map((tag) => (
          <li key={tag} className="as-tags__tag">
            <span>{tag}</span>
            <button
              type="button"
              className="as-tags__x"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(removeTag(tags, tag))}
            >
              <X size={12} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </li>
        ))}
        {tags.length < MAX_TAGS && (
          <li>
            <input
              className="as-tags__add"
              aria-label="Add a tag"
              placeholder="+ Tag"
              maxLength={MAX_TAG_LENGTH + 1}
              size={Math.max(5, normaliseTag(draft).length + 1)}
              value={draft}
              onChange={(event) => setDraft(event.target.value.replace(/,/g, ''))}
              onKeyDown={onKeyDown}
              onBlur={() => draft.trim() && commit(draft)}
            />
          </li>
        )}
      </ul>
    </div>
  )
}
