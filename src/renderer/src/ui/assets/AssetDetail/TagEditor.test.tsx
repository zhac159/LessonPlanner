import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TagEditor } from './TagEditor'

describe('TagEditor', () => {
  it('lists the tags and a "+ Tag" field', () => {
    render(<TagEditor tags={['logo', 'title slides']} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Tags' })).toBeInTheDocument()
    expect(screen.getByText('logo')).toBeInTheDocument()
    expect(screen.getByText('title slides')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Add a tag' })).toHaveAttribute(
      'placeholder',
      '+ Tag'
    )
  })

  it('adds a tag with Enter, lower-cased', async () => {
    const onChange = vi.fn()
    render(<TagEditor tags={['logo']} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'Title Slides{Enter}')
    expect(onChange).toHaveBeenCalledWith(['logo', 'title slides'])
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('adds a tag with a comma', async () => {
    const onChange = vi.fn()
    render(<TagEditor tags={[]} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'owl,')
    expect(onChange).toHaveBeenCalledWith(['owl'])
  })

  it('adds what is typed when the field loses focus', async () => {
    const onChange = vi.fn()
    render(<TagEditor tags={[]} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'owl')
    await userEvent.tab()
    expect(onChange).toHaveBeenCalledWith(['owl'])
  })

  it('ignores a duplicate and an empty tag', async () => {
    const onChange = vi.fn()
    render(<TagEditor tags={['logo']} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'LOGO{Enter}')
    await userEvent.type(screen.getByRole('textbox'), '   {Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a tag with its named × button', async () => {
    const onChange = vi.fn()
    render(<TagEditor tags={['logo', 'title slides']} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove tag logo' }))
    expect(onChange).toHaveBeenCalledWith(['title slides'])
  })

  it('Esc clears the draft without adding', async () => {
    const onChange = vi.fn()
    render(<TagEditor tags={[]} onChange={onChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'owl{Escape}')
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hides the field at 12 tags', () => {
    const tags = Array.from({ length: 12 }, (_, i) => `t${i}`)
    render(<TagEditor tags={tags} onChange={() => {}} />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
