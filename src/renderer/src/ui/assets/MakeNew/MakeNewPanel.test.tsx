import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MakeNewPanel, type MakeNewPanelProps } from './MakeNewPanel'

const ready = (index: number) => ({
  index,
  state: 'ready' as const,
  thumbSrc: 'data:image/png;base64,AA'
})

function props(extra: Partial<MakeNewPanelProps> = {}): MakeNewPanelProps {
  return {
    basedOn: {
      items: [
        { id: 'a', name: 'beaker_icon' },
        { id: 'b', name: 'microscope_icon' },
        { id: 'c', name: 'timer_icon' }
      ],
      onRemove: vi.fn()
    },
    request: {
      prompt: 'A Bunsen burner with a lit flame',
      onPromptChange: vi.fn(),
      versions: 4,
      onVersionsChange: vi.fn(),
      onMake: vi.fn(),
      mode: 'picture-maker',
      perPictureUsd: 0.134
    },
    ...extra
  }
}

describe('MakeNewPanel', () => {
  it('is a region with the yellow header copy, Based on and the request', () => {
    render(<MakeNewPanel {...props()} />)
    const panel = screen.getByRole('region', { name: 'Make a new one like these' })
    expect(
      within(panel).getByRole('heading', { name: 'Make a new one like these' })
    ).toBeInTheDocument()
    expect(
      within(panel).getByText('Same lines, colours and feel as the ones you picked')
    ).toBeInTheDocument()
    expect(within(panel).getByRole('region', { name: 'Based on' })).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem')).toHaveLength(3)
    expect(within(panel).getByRole('button', { name: 'Make 4' })).toBeInTheDocument()
  })

  it('shows no versions or Keep before a job has run', () => {
    render(<MakeNewPanel {...props()} />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: /Keep/ })).toBeNull()
  })

  it('shows the versions, the name and Keep once there are results, and the watermark footnote', async () => {
    const onKeep = vi.fn()
    render(
      <MakeNewPanel
        {...props({
          versions: {
            versions: [ready(1), ready(2), ready(3), ready(4)],
            selected: 3,
            onSelect: vi.fn()
          },
          keep: {
            version: 3,
            name: 'bunsen_burner_icon',
            onNameChange: vi.fn(),
            onKeep,
            onTryAgain: vi.fn()
          },
          footnote: 'Pictures made with Nano Banana Pro carry an invisible Google watermark.'
        })}
      />
    )
    expect(screen.getByRole('radiogroup', { name: 'Pick the one you like' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name in chat' })).toHaveValue('bunsen_burner_icon')
    await userEvent.click(screen.getByRole('button', { name: 'Keep version 3' }))
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText('Pictures made with Nano Banana Pro carry an invisible Google watermark.')
    ).toBeInTheDocument()
  })

  it('shows versions without the Keep form while they are still being made', () => {
    render(
      <MakeNewPanel
        {...props({
          versions: {
            versions: [{ index: 1, state: 'waiting' }],
            selected: null,
            onSelect: vi.fn(),
            stageLabel: 'Looking at your pictures…'
          }
        })}
      />
    )
    expect(screen.getByText('Looking at your pictures…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Keep/ })).toBeNull()
  })
})
