import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupEditor, RUNNING_CHAT } from './testing'
import { resetStubs, seen } from './testStubs'

vi.mock('../chat', async () => (await import('./testStubs')).chatModule)
vi.mock('../circle', async () => (await import('./testStubs')).circleModule)

beforeEach(() => {
  resetStubs()
  window.localStorage.clear()
})

const open = async (options = {}) => {
  const view = setupEditor(options)
  await screen.findByRole('navigation', { name: 'Slides' })
  return view
}
const fullScreen = () => window.api.window.setFullScreen as unknown as ReturnType<typeof vi.fn>
const counter = () => screen.getByText(/ \/ 3$/).textContent

describe('Present from the editor', () => {
  it('the Present button starts from the slide on the stage and goes full screen', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: /^Slide 2/ }))
    await view.user.click(screen.getByRole('button', { name: 'Present' }))
    expect(screen.getByRole('dialog', { name: 'Slide show' })).toBeInTheDocument()
    expect(counter()).toBe('2 / 3')
    expect(fullScreen()).toHaveBeenLastCalledWith(true)
  })

  it('F5 starts from slide 1, Shift+F5 from the current slide', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: /^Slide 3(:|$)/ }))
    fireEvent.keyDown(document, { key: 'F5' })
    expect(counter()).toBe('1 / 3')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await view.user.click(screen.getByRole('button', { name: /^Slide 3(:|$)/ }))
    fireEvent.keyDown(document, { key: 'F5', shiftKey: true })
    expect(counter()).toBe('3 / 3')
  })

  it('arrows move through the show and Esc leaves it, selecting the slide she ended on', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Present' }))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fullScreen()).toHaveBeenLastCalledWith(false)
    expect(seen.chat?.currentSlideId).toBe('s3')
    expect(screen.getByRole('group', { name: 'Slide editing area' })).toHaveFocus()
  })

  it('the editor’s own shortcuts stay quiet during the show', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Present' }))
    fireEvent.keyDown(document, { key: 'e', ctrlKey: true })
    expect(view.db.exportPptx).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'c' })
    expect(seen.chat?.circleToolActive).toBe(false)
  })

  it('does not start with no slides or while a job runs', async () => {
    const empty = await open({
      view: {
        runningJob: RUNNING_CHAT
      }
    })
    await empty.user.click(screen.getByRole('button', { name: 'Present' }))
    fireEvent.keyDown(document, { key: 'F5' })
    expect(screen.queryByRole('dialog', { name: 'Slide show' })).not.toBeInTheDocument()
  })

  it('lets go of full screen if the editor goes away mid-show', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Present' }))
    fullScreen().mockClear()
    view.unmount()
    expect(fullScreen()).toHaveBeenCalledWith(false)
  })

  it('does not listen for F5 when the module is hidden', async () => {
    await open({ props: { active: false } })
    fireEvent.keyDown(document, { key: 'F5' })
    expect(screen.queryByRole('dialog', { name: 'Slide show' })).not.toBeInTheDocument()
  })
})
