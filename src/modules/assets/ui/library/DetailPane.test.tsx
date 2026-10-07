import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ok } from '@shared/result'
import { renderAssets } from '../testRender'
import { SAMPLE, makeDetail } from '../testSupport'

describe('DetailPane: vector pictures with parts that are not drawn', () => {
  it('warns which parts are left out and says the file itself is kept', async () => {
    renderAssets({
      assets: {
        get: () =>
          ok({ asset: makeDetail(SAMPLE[0]!, { leftOut: 'embedded pictures and some styling' }) })
      }
    })
    const warning = await screen.findByText('Some parts are not shown')
    expect(warning).toBeInTheDocument()
    expect(screen.getByText(/embedded pictures and some styling/)).toBeInTheDocument()
    expect(screen.getByText(/Your file is kept exactly as it was/)).toBeInTheDocument()
  })

  it('shows no warning for a picture that is drawn completely', async () => {
    renderAssets()
    await screen.findByRole('region', { name: 'School logo' })
    expect(screen.queryByText('Some parts are not shown')).not.toBeInTheDocument()
  })
})
