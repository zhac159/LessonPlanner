import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessageAssistant } from './MessageAssistant'

describe('MessageAssistant: custom inline drawing', () => {
  it('draws each run of text through renderInline, bold included', () => {
    render(
      <MessageAssistant
        text={'Done! {{school_logo}} is **here**.\n\n- and {{owl}}'}
        renderInline={(text) => text.replace(/\{\{(\w+)\}\}/g, '[$1]')}
      />
    )
    expect(screen.getByText('Done! [school_logo] is', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('here').tagName).toBe('STRONG')
    expect(screen.getByRole('listitem')).toHaveTextContent('and [owl]')
  })

  it('is unchanged without it', () => {
    render(<MessageAssistant text="Done! **bold** text" />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })
})
