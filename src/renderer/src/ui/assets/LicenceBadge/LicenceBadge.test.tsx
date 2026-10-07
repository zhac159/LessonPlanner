import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LICENCES } from '@shared/assets/credits'
import type { LicenceId } from '@shared/assets/types'
import { LicenceBadge, licenceTone } from './LicenceBadge'

describe('LicenceBadge', () => {
  it.each([
    ['cc0', 'green', 'CC0'],
    ['public-domain', 'green', 'Public domain'],
    ['cc-by', 'blue', 'CC BY'],
    ['cc-by-sa', 'blue', 'CC BY-SA'],
    ['own', 'neutral', 'Yours'],
    ['generated', 'neutral', 'Made for you']
  ] as const)('%s is %s and reads "%s"', (id, tone, text) => {
    render(<LicenceBadge licence={LICENCES[id]} />)
    expect(screen.getByText(text)).toHaveAttribute('data-tone', tone)
  })

  it.each(['cc-by-nc', 'cc-by-nc-sa', 'cc-by-nc-nd', 'cc-by-nd', 'other'] as LicenceId[])(
    '%s is amber and says "Check licence" with the real licence on hover',
    (id) => {
      render(<LicenceBadge licence={LICENCES[id]} />)
      const badge = screen.getByText('Check licence')
      expect(badge).toHaveAttribute('data-tone', 'amber')
      expect(badge).toHaveAttribute('title', LICENCES[id].label)
    }
  )

  it('can show the exact label on amber (the detail pane)', () => {
    render(<LicenceBadge licence={LICENCES['cc-by-nc']} exact />)
    expect(screen.getByText('CC BY-NC')).toHaveAttribute('data-tone', 'amber')
  })

  it('maps every known licence to a tone', () => {
    for (const id of Object.keys(LICENCES) as LicenceId[]) {
      expect(['green', 'blue', 'amber', 'neutral']).toContain(licenceTone(id))
    }
  })
})
