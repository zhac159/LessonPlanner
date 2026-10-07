import { createEvent, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ok } from '@shared/result'
import module from '../ui'
import { renderAssets } from './testRender'
import { makeReview } from './testSupport'

describe('the Assets module entry', () => {
  it('is a top sidebar item called Assets between Styles and Settings', () => {
    expect(module).toMatchObject({ id: 'assets', title: 'Assets', nav: 'top', chrome: 'sidebar' })
    expect(module.order).toBeGreaterThan(20)
    expect(module.order).toBeLessThan(100)
  })
})

describe('AssetsView intents and drops', () => {
  it('opens the library by default', async () => {
    renderAssets()
    expect(await screen.findByRole('heading', { name: 'Your assets' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Your assets/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('opens the review for a review intent and consumes the intent', async () => {
    const { shell } = renderAssets({
      assets: { 'review:get': () => makeReview() },
      shell: { intent: { kind: 'review', batchId: 'b1' } }
    })
    expect(await screen.findByRole('heading', { name: 'Check what I found' })).toBeInTheDocument()
    expect(shell.consumeIntent).toHaveBeenCalled()
  })

  it('goes back from the review to the library', async () => {
    const { user } = renderAssets({
      assets: { 'review:get': () => makeReview() },
      shell: { intent: { kind: 'review' } }
    })
    await user.click(await screen.findByRole('button', { name: 'Assets' }))
    expect(await screen.findByRole('heading', { name: 'Your assets' })).toBeInTheDocument()
  })

  it('ignores an intent it does not know but still consumes it', async () => {
    const { shell } = renderAssets({ shell: { intent: { kind: 'something-else' } } })
    expect(await screen.findByRole('heading', { name: 'Your assets' })).toBeInTheDocument()
    expect(shell.consumeIntent).toHaveBeenCalled()
  })

  it('adds files dropped anywhere on the page and opens the review', async () => {
    const paths = vi.fn(() => ok({ batchId: 'b3', accepted: 1, rejected: [] }))
    renderAssets({ assets: { 'add:paths': paths, 'review:get': () => makeReview() } })
    const heading = await screen.findByRole('heading', { name: 'Your assets' })
    const file = new File(['x'], 'owl.png', { type: 'image/png' })
    const drop = createEvent.drop(heading)
    Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files: [file] } })
    fireEvent(heading, drop)
    await waitFor(() => expect(paths).toHaveBeenCalledWith({ paths: ['/fake/owl.png'] }))
    expect(await screen.findByRole('heading', { name: 'Check what I found' })).toBeInTheDocument()
  })

  it('ignores drags that are not files', async () => {
    const paths = vi.fn()
    renderAssets({ assets: { 'add:paths': paths } })
    const heading = await screen.findByRole('heading', { name: 'Your assets' })
    const drop = createEvent.drop(heading)
    Object.defineProperty(drop, 'dataTransfer', { value: { types: ['text/plain'], files: [] } })
    fireEvent(heading, drop)
    expect(paths).not.toHaveBeenCalled()
  })
})
