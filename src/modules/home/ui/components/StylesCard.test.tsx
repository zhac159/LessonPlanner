import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { style } from '../fixtures'
import { StylesCard, type StylesCardProps } from './StylesCard'

const SCIENCE = style()
const FORM = style({
  id: 's2',
  name: 'Form time',
  isDefault: false,
  titleFont: 'Nunito',
  deckCount: 6
})

function setup(props: Partial<StylesCardProps> = {}) {
  const handlers = { onOpen: vi.fn(), onManage: vi.fn(), onBrowse: vi.fn(), onFiles: vi.fn() }
  const styles = props.styles ?? [SCIENCE, FORM]
  render(
    <StylesCard
      loading={false}
      styles={styles}
      matching={styles}
      query=""
      busy={false}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

const dropOf = (...names: string[]) => ({
  dataTransfer: { files: names.map((name) => new File(['x'], name)), items: [], types: ['Files'] }
})

describe('StylesCard', () => {
  it('lists the styles with their meta line and the Default pill', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Your styles' })).toBeInTheDocument()
    const science = screen.getByRole('button', { name: /Science KS3/ })
    expect(science).toHaveAccessibleDescription('Lexend · learned from 24 decks')
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Form time/ })).toHaveAccessibleDescription(
      'Nunito · learned from 6 decks'
    )
  })

  it('opens a style and the Styles list', async () => {
    const { onOpen, onManage } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Form time/ }))
    expect(onOpen).toHaveBeenCalledWith('s2')
    await userEvent.click(screen.getByRole('button', { name: 'Manage' }))
    expect(onManage).toHaveBeenCalledTimes(1)
  })

  it('shows two skeletons and still offers the Dropzone while loading', () => {
    setup({ loading: true, styles: [], matching: [] })
    expect(screen.getByTestId('styles-loading').children).toHaveLength(2)
    expect(screen.queryByText(/Teach me your style first/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create a new style/ })).toBeInTheDocument()
  })

  it('with no styles asks her to teach one and shows only the Dropzone', () => {
    setup({ styles: [], matching: [] })
    expect(
      screen.getByText('Teach me your style first so new lessons look like yours.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('says when no style matches the search', () => {
    setup({ matching: [], query: 'zzz' })
    expect(screen.getByText('No styles match “zzz”')).toBeInTheDocument()
  })

  it('shows the first three styles and a "Show all" link', async () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      style({ id, name: `Style ${id}`, isDefault: false })
    )
    const { onManage } = setup({ styles: many, matching: many })
    expect(screen.getAllByRole('article')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Show all 5 styles' }))
    expect(onManage).toHaveBeenCalledTimes(1)
  })

  it('describes the Dropzone and browses on click', async () => {
    const { onBrowse } = setup()
    const zone = screen.getByRole('button', { name: /Create a new style/ })
    expect(zone).toHaveTextContent('Drop old PDFs or PowerPoints here, or browse files')
    expect(zone).toHaveTextContent('.pdf and .pptx · up to 50 files')
    await userEvent.click(zone)
    expect(onBrowse).toHaveBeenCalledTimes(1)
  })

  it('browses from the keyboard', async () => {
    const { onBrowse } = setup()
    screen.getByRole('button', { name: /Create a new style/ }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onBrowse).toHaveBeenCalledTimes(1)
  })

  it('passes dropped files on', () => {
    const { onFiles } = setup()
    fireEvent.drop(
      screen.getByRole('button', { name: /Create a new style/ }),
      dropOf('a.pdf', 'b.jpg')
    )
    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf', 'b.jpg'])
  })

  it('shows a busy Dropzone while a draft is being created', () => {
    setup({ busy: true })
    expect(screen.getByRole('button', { name: /Starting your style/ })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })
})
