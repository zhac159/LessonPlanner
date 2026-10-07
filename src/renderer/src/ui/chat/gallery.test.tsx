import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gallery } from '../gallery'
import chat from './gallery'

describe('chat gallery specimens', () => {
  it('render without crashing and every section has a heading', () => {
    render(<Gallery groups={[chat]} />)
    expect(screen.getByRole('region', { name: chat.title })).toBeInTheDocument()
    for (const section of chat.sections) {
      expect(section.name.length).toBeGreaterThan(0)
      expect(screen.getByRole('heading', { level: 3, name: section.name })).toBeInTheDocument()
    }
  })

  it('covers every chat component', () => {
    const names = chat.sections.map((s) => s.name.split(' ·')[0])
    expect(names).toEqual([
      'AttachmentCard',
      'RegionChip',
      'ResultChip',
      'MessageUser',
      'MessageAssistant',
      'MessageProgress',
      'Composer',
      'ChatPanel'
    ])
  })
})
