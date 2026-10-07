import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LICENCES } from '@shared/assets/credits'
import type { LicenceId } from '@shared/assets/types'
import { OnlineDetail, licenceNotice } from './OnlineDetail'

const setup = (
  licence: LicenceId = 'cc-by-sa',
  extra: Partial<Parameters<typeof OnlineDetail>[0]> = {}
) => {
  const handlers = { onAdd: vi.fn(), onOpenSource: vi.fn(), onNameChange: vi.fn() }
  render(
    <OnlineDetail
      title="Volcano cross-section"
      providerLabel="Wikimedia Commons"
      licence={{
        ...LICENCES[licence],
        label: licence === 'cc-by-sa' ? 'CC BY-SA 4.0' : LICENCES[licence].label
      }}
      width={1600}
      height={1200}
      name="volcano_cross_section"
      {...handlers}
      {...extra}
    />
  )
  return handlers
}

describe('licenceNotice', () => {
  it.each([
    ['cc-by-sa', 'info', 'This one needs a credit.'],
    ['cc0', 'info', 'No credit needed for this one.'],
    ['public-domain', 'info', 'No credit needed for this one.'],
    ['cc-by-nc', 'warning', "This licence doesn't cover every use."],
    ['other', 'warning', "This licence doesn't cover every use."]
  ] as const)('%s gives a %s notice starting "%s"', (id, variant, start) => {
    const notice = licenceNotice(LICENCES[id])
    expect(notice.variant).toBe(variant)
    expect(notice.text.startsWith(start)).toBe(true)
  })
})

describe('OnlineDetail', () => {
  it('shows the title, source, exact licence, size and the credit notice', () => {
    setup()
    expect(screen.getByRole('region', { name: 'Volcano cross-section' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Volcano cross-section' })).toBeInTheDocument()
    expect(screen.getByText('Wikimedia Commons')).toBeInTheDocument()
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument()
    expect(screen.getByText('1600 × 1200')).toBeInTheDocument()
    expect(
      screen.getByText(
        "This one needs a credit. I'll add it to the speaker notes of any slide that uses it."
      )
    ).toBeInTheDocument()
  })

  it('says no credit is needed for CC0', () => {
    setup('cc0')
    expect(screen.getByText('No credit needed for this one.')).toBeInTheDocument()
  })

  it('warns on an amber licence', () => {
    setup('cc-by-nc')
    expect(screen.getByText(/This licence doesn't cover every use/)).toBeInTheDocument()
  })

  it('leaves out the size when it is not known', () => {
    setup('cc-by-sa', { width: null, height: null })
    expect(screen.queryByText(/×/)).toBeNull()
  })

  it('has an editable "Name in chat" and shows its error', async () => {
    const h = setup('cc-by-sa', { nameError: 'You already have an asset called volcano.' })
    const field = screen.getByRole('textbox', { name: 'Name in chat' })
    expect(field).toHaveValue('volcano_cross_section')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('You already have an asset called volcano.')).toBeInTheDocument()
    await userEvent.type(field, 'x')
    expect(h.onNameChange).toHaveBeenCalledWith('volcano_cross_sectionx')
  })

  it('adds and opens the source page', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Add to Your assets' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open source page' }))
    expect(h.onAdd).toHaveBeenCalledTimes(1)
    expect(h.onOpenSource).toHaveBeenCalledTimes(1)
  })

  it('shows a busy add button', () => {
    setup('cc-by-sa', { adding: true })
    expect(screen.getByRole('button', { name: /Add to Your assets/ })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })
})
