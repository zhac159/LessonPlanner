import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MakeRequestForm, type MakeRequestFormProps } from './MakeRequestForm'

function setup(extra: Partial<MakeRequestFormProps> = {}) {
  const h = { onPromptChange: vi.fn(), onVersionsChange: vi.fn(), onMake: vi.fn() }
  render(
    <MakeRequestForm
      prompt="A Bunsen burner with a lit flame"
      versions={4}
      mode="picture-maker"
      perPictureUsd={0.134}
      {...h}
      {...extra}
    />
  )
  return h
}

describe('MakeRequestForm', () => {
  it('shows the prompt, Versions 2 and 4 (4 chosen) and "Make 4"', () => {
    setup()
    expect(screen.getByRole('textbox', { name: 'What should it be?' })).toHaveValue(
      'A Bunsen burner with a lit flame'
    )
    expect(screen.getByRole('group', { name: 'Versions' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '4' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '2' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Make 4' })).toBeInTheDocument()
  })

  it('shows the cost under the button, following the versions', () => {
    const { rerender } = render(
      <MakeRequestForm
        prompt="x"
        versions={4}
        mode="picture-maker"
        perPictureUsd={0.134}
        onPromptChange={() => {}}
        onVersionsChange={() => {}}
        onMake={() => {}}
      />
    )
    expect(screen.getByText('About 54 cents · Google bills this')).toBeInTheDocument()
    rerender(
      <MakeRequestForm
        prompt="x"
        versions={2}
        mode="picture-maker"
        perPictureUsd={0.134}
        onPromptChange={() => {}}
        onVersionsChange={() => {}}
        onMake={() => {}}
      />
    )
    expect(screen.getByText('About 27 cents · Google bills this')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make 2' })).toBeInTheDocument()
  })

  it('reports typing, the versions choice and Make', async () => {
    const h = setup()
    await userEvent.type(screen.getByRole('textbox'), '!')
    expect(h.onPromptChange).toHaveBeenLastCalledWith('A Bunsen burner with a lit flame!')
    await userEvent.click(screen.getByRole('radio', { name: '2' }))
    expect(h.onVersionsChange).toHaveBeenCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Make 4' }))
    expect(h.onMake).toHaveBeenCalledTimes(1)
  })

  it('an empty request disables Make, says why, and does not fire', async () => {
    const h = setup({ prompt: '   ' })
    const button = screen.getByRole('button', { name: 'Make 4' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button.getAttribute('aria-describedby')).toBe(
      screen.getByText('Say what the new picture should be first.').id
    )
    await userEvent.click(button)
    expect(h.onMake).not.toHaveBeenCalled()
  })

  it('shows a busy button while a job runs', async () => {
    const h = setup({ busy: true })
    const button = screen.getByRole('button', { name: /Making/ })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(h.onMake).not.toHaveBeenCalled()
  })

  it('vector mode explains Claude will draw it and links to the picture maker; no price', async () => {
    const onAddPictureMaker = vi.fn()
    setup({ mode: 'vector', onAddPictureMaker })
    expect(
      screen.getByText(
        /No picture maker connected, so Claude will draw this as a simple icon or diagram\./
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Google bills this/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Add a picture maker' }))
    expect(onAddPictureMaker).toHaveBeenCalledTimes(1)
  })

  it('vector mode warns when the request asks for a photo', () => {
    setup({ mode: 'vector', wantsPhoto: true })
    expect(
      screen.getByText(
        'Photo-like pictures need the picture maker. Add one in Settings › AI, or try Find online.'
      )
    ).toBeInTheDocument()
  })

  it('no photo warning in picture-maker mode', () => {
    setup({ wantsPhoto: true })
    expect(screen.queryByText(/Photo-like pictures need/)).toBeNull()
  })

  it('unavailable mode blocks Make and says why', async () => {
    const h = setup({ mode: 'unavailable' })
    expect(screen.getAllByText(/needs your Claude key/).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Make 4' }))
    expect(h.onMake).not.toHaveBeenCalled()
  })
})
