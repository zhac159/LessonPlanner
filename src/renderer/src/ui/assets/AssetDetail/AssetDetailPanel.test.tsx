import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LICENCES } from '@shared/assets/credits'
import type { AssetDetail } from '@shared/contracts/assets'
import { AssetDetailPanel, type AssetDetailPanelProps } from './AssetDetailPanel'

const asset: AssetDetail = {
  id: 'ast_1',
  name: 'school_logo',
  title: 'School logo',
  kind: 'logo',
  tags: ['logo', 'title slides'],
  thumbDataUrl: 'data:image/png;base64,AA',
  width: 512,
  height: 512,
  sourceKind: 'extracted',
  licenceBadge: null,
  usedInCount: 14,
  foundInCount: 24,
  lastUsedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  description: 'School crest: navy shield with a gold chevron and star.',
  source: {
    kind: 'extracted',
    styleId: null,
    fileName: 'Y8 Photosynthesis.pptx',
    page: 1,
    at: 'x'
  },
  licence: LICENCES.unknown,
  credit: null,
  foundIn: [{ styleId: null, sourceId: 's', fileName: 'Y8 Photosynthesis.pptx', page: 1 }],
  bytes: 1000,
  previewDataUrl: 'data:image/png;base64,BB'
}

function setup(extra: Partial<AssetDetailPanelProps> = {}, over: Partial<AssetDetail> = {}) {
  const h = {
    onNameDraft: vi.fn(),
    onRename: vi.fn(),
    onTitleCommit: vi.fn(),
    onDescriptionCommit: vi.fn(),
    onTagsChange: vi.fn(),
    onUseInLesson: vi.fn(),
    onReplaceFile: vi.fn(),
    onDelete: vi.fn(),
    onOpenUsage: vi.fn(),
    onOpenSource: vi.fn()
  }
  render(<AssetDetailPanel asset={{ ...asset, ...over }} {...h} {...extra} />)
  return h
}

describe('AssetDetailPanel', () => {
  it('is a region labelled with the asset title and shows every value', () => {
    setup()
    const pane = screen.getByRole('region', { name: 'School logo' })
    expect(within(pane).getByRole('textbox', { name: 'Title' })).toHaveValue('School logo')
    expect(within(pane).getByRole('textbox', { name: 'Name in chat' })).toHaveValue('school_logo')
    expect(
      within(pane).getByRole('textbox', { name: 'What it is (Claude reads this)' })
    ).toHaveValue('School crest: navy shield with a gold chevron and star.')
    expect(within(pane).getByText('logo')).toBeInTheDocument()
    expect(within(pane).getByText('title slides')).toBeInTheDocument()
    expect(pane).toHaveTextContent('Found in Y8 Photosynthesis.pptx, slide 1')
    expect(pane).toHaveTextContent('Used in 14 lessons')
  })

  it('shows the large preview, with empty alt text', () => {
    const { container } = render(
      <AssetDetailPanel
        asset={asset}
        onRename={() => {}}
        onTitleCommit={() => {}}
        onDescriptionCommit={() => {}}
        onTagsChange={() => {}}
        onUseInLesson={() => {}}
        onReplaceFile={() => {}}
        onDelete={() => {}}
      />
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,BB')
    expect(img).toHaveAttribute('alt', '')
  })

  it('renames on Enter and shows a name error in place of the helper', async () => {
    const h = setup({ nameError: 'You already have an asset called owl_mascot.' })
    expect(screen.getByText('You already have an asset called owl_mascot.')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Name in chat' }), 'x{Enter}')
    expect(h.onRename).toHaveBeenCalledWith('school_logox')
  })

  it('saves the description on blur only when changed', async () => {
    const h = setup()
    const box = screen.getByRole('textbox', { name: 'What it is (Claude reads this)' })
    await userEvent.click(box)
    await userEvent.tab()
    expect(h.onDescriptionCommit).not.toHaveBeenCalled()
    await userEvent.type(box, ' More.')
    await userEvent.tab()
    expect(h.onDescriptionCommit).toHaveBeenCalledWith(
      'School crest: navy shield with a gold chevron and star. More.'
    )
  })

  it('shows a character counter near the limit', () => {
    setup({}, { description: 'x'.repeat(380) })
    expect(screen.getByText('380 / 400')).toBeInTheDocument()
  })

  it('saves the title and the tags', async () => {
    const h = setup()
    await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), ' 2{Enter}')
    expect(h.onTitleCommit).toHaveBeenCalledWith('School logo 2')
    await userEvent.click(screen.getByRole('button', { name: 'Remove tag logo' }))
    expect(h.onTagsChange).toHaveBeenCalledWith(['title slides'])
  })

  it('has the three actions and a delete button named after the asset', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Use in a lesson' }))
    await userEvent.click(screen.getByRole('button', { name: 'Replace file' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete school_logo' }))
    expect(h.onUseInLesson).toHaveBeenCalledTimes(1)
    expect(h.onReplaceFile).toHaveBeenCalledTimes(1)
    expect(h.onDelete).toHaveBeenCalledTimes(1)
  })

  it('opens the usage from the lesson count', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: '14 lessons' }))
    expect(h.onOpenUsage).toHaveBeenCalledTimes(1)
  })

  it('keeps "Use in a lesson" focusable but silent, with the reason, when there is no lesson', async () => {
    const h = setup({ useDisabledReason: 'Make a lesson first' })
    const button = screen.getByRole('button', { name: 'Use in a lesson' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('title', 'Make a lesson first')
    await userEvent.click(button)
    expect(h.onUseInLesson).not.toHaveBeenCalled()
  })

  it('shows the source, licence, credit and source link for a picture found online', async () => {
    const h = setup(
      {},
      {
        sourceKind: 'online',
        foundIn: [],
        source: { kind: 'online', provider: 'wikimedia', at: 'x' },
        licence: { ...LICENCES['cc-by-sa'], label: 'CC BY-SA 4.0' },
        credit: {
          text: '“Volcano” by Ann, CC BY-SA 4.0, via Wikimedia Commons',
          inNotes: true,
          provider: 'wikimedia',
          author: 'Ann',
          title: 'Volcano',
          pageUrl: 'https://commons.wikimedia.org/x',
          licenceUrl: null
        }
      }
    )
    expect(screen.getByText('Wikimedia Commons')).toBeInTheDocument()
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument()
    expect(screen.getByTestId('credit-text')).toHaveTextContent('“Volcano” by Ann')
    expect(screen.getByText('Picked online')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open source page' }))
    expect(h.onOpenSource).toHaveBeenCalledTimes(1)
  })

  it('shows no source or credit block for her own pictures', () => {
    setup()
    expect(screen.queryByText('Credit')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open source page' })).toBeNull()
  })

  it('announces a status politely', () => {
    setup({ status: 'School logo saved' })
    expect(screen.getByRole('status')).toHaveTextContent('School logo saved')
  })
})
