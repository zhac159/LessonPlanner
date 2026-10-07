import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeckBuilderApi } from '@shared/contracts/deck-builder'
import { fail, ok } from '@shared/result'
import { ClientsProvider } from '@renderer/core/ClientsContext'
import { ShellContext } from '@renderer/core/ShellContext'
import type { NavIntent } from '@renderer/sdk'
import { ToastProvider } from '@ui/overlays'
import { createFakeClients, fakeClient, fakeShell, installFakeWindowApi } from '@test/render'
import { DeckBuilderView } from './DeckBuilderView'
import type { EditorScreenProps } from './editor/EditorScreen'
import type { NewLessonScreenProps } from './seams'

const editorProps: EditorScreenProps[] = []
const newLessonProps: NewLessonScreenProps[] = []

vi.mock('./editor/EditorScreen', () => ({
  EditorScreen: (props: EditorScreenProps) => {
    editorProps.push(props)
    return (
      <div>
        <p>Editor {props.lessonId}</p>
        <p>token {props.reloadToken}</p>
        <p>composer {props.composer ? `${props.composer.text}#${props.composer.key}` : '(none)'}</p>
        <button onClick={props.onBack}>stub back</button>
        <button onClick={props.onConnectClaude}>stub connect</button>
      </div>
    )
  }
}))
vi.mock('./newLesson', () => ({
  NewLessonScreen: (props: NewLessonScreenProps) => {
    newLessonProps.push(props)
    return (
      <div>
        <p>New lesson {props.prefill?.title ?? '(blank)'}</p>
        <button onClick={() => props.onOpenLesson('les_new')}>stub open</button>
        <button onClick={props.onBack}>stub new back</button>
      </div>
    )
  }
}))

beforeEach(() => {
  editorProps.length = 0
  newLessonProps.length = 0
  installFakeWindowApi()
})

function mount(intent: NavIntent | null, createLesson?: DeckBuilderApi['createLesson']) {
  const shell = fakeShell({ intent })
  const clients = createFakeClients({
    'deck-builder': fakeClient<DeckBuilderApi>(createLesson ? { createLesson } : {})
  })
  const tree = (value: typeof shell, active = true) => (
    <ShellContext.Provider value={value}>
      <ClientsProvider clients={clients}>
        <ToastProvider>
          <DeckBuilderView active={active} api={{ invoke: vi.fn(), on: vi.fn() }} />
        </ToastProvider>
      </ClientsProvider>
    </ShellContext.Provider>
  )
  const view = render(tree(shell))
  return {
    shell,
    ...view,
    /** The shell hands over a new intent. */
    send(next: NavIntent) {
      const updated = { ...shell, intent: next }
      view.rerender(tree(updated))
      return updated
    }
  }
}

describe('DeckBuilderView', () => {
  it('shows the New lesson screen when there is no intent', () => {
    mount(null)
    expect(screen.getByText('New lesson (blank)')).toBeInTheDocument()
  })

  it('open-lesson shows the editor and consumes the intent', () => {
    const { shell } = mount({ kind: 'open-lesson', lessonId: 'les_9' })
    expect(screen.getByText('Editor les_9')).toBeInTheDocument()
    expect(shell.consumeIntent).toHaveBeenCalled()
  })

  it('new-lesson passes the Home quick-card text on', () => {
    mount({ kind: 'new-lesson', title: 'Cells', text: 'Know cells' })
    expect(screen.getByText('New lesson Cells')).toBeInTheDocument()
    expect(newLessonProps[0].prefill).toEqual({ title: 'Cells', text: 'Know cells' })
  })

  it('new-lesson puts composerText (from the Assets page) in the box', () => {
    mount({ kind: 'new-lesson', composerText: '{{owl}} ' })
    expect(newLessonProps[0].prefill).toEqual({ title: undefined, text: '{{owl}} ' })
  })

  it('open-lesson hands composerText to the editor, again for every new request', () => {
    const view = mount({ kind: 'open-lesson', lessonId: 'les_1', composerText: '{{owl}} ' })
    expect(screen.getByText(/^composer {{owl}} #/)).toBeInTheDocument()
    const first = editorProps.at(-1)?.composer?.key
    view.send({ kind: 'open-lesson', lessonId: 'les_1', composerText: '{{owl}} ' })
    expect(screen.getByText('token 1')).toBeInTheDocument()
    expect(editorProps.at(-1)?.composer?.text).toBe('{{owl}} ')
    expect(editorProps.at(-1)?.composer?.key).not.toBe(first)
  })

  it('open-lesson without composerText sends none', () => {
    mount({ kind: 'open-lesson', lessonId: 'les_1' })
    expect(screen.getByText('composer (none)')).toBeInTheDocument()
  })

  it('opens the editor on the lesson the New lesson screen made', async () => {
    mount(null)
    await userEvent.click(screen.getByRole('button', { name: 'stub open' }))
    expect(screen.getByText('Editor les_new')).toBeInTheDocument()
  })

  it('goes Home from either screen', async () => {
    const first = mount(null)
    await userEvent.click(screen.getByRole('button', { name: 'stub new back' }))
    expect(first.shell.navigate).toHaveBeenCalledWith('home')
    first.unmount()
    const second = mount({ kind: 'open-lesson', lessonId: 'les_1' })
    await userEvent.click(screen.getByRole('button', { name: 'stub back' }))
    expect(second.shell.navigate).toHaveBeenCalledWith('home')
  })

  it('sends “Connect Claude” to Settings → AI', async () => {
    const view = mount({ kind: 'open-lesson', lessonId: 'les_1' })
    await userEvent.click(screen.getByRole('button', { name: 'stub connect' }))
    expect(view.shell.navigate).toHaveBeenCalledWith('settings', { kind: 'ai' })
  })

  it('a new intent switches screens while the module stays mounted', () => {
    const view = mount({ kind: 'open-lesson', lessonId: 'les_1' })
    expect(screen.getByText('Editor les_1')).toBeInTheDocument()
    view.send({ kind: 'open-lesson', lessonId: 'les_2' })
    expect(screen.getByText('Editor les_2')).toBeInTheDocument()
    view.send({ kind: 'new-lesson' })
    expect(screen.getByText('New lesson (blank)')).toBeInTheDocument()
  })

  it('opening the lesson that is already open re-reads it instead of remounting', () => {
    const view = mount({ kind: 'open-lesson', lessonId: 'les_1' })
    expect(screen.getByText('token 0')).toBeInTheDocument()
    view.send({ kind: 'open-lesson', lessonId: 'les_1' })
    expect(screen.getByText('token 1')).toBeInTheDocument()
  })

  it('ignores intents that are not for it but still consumes them', () => {
    const view = mount({ kind: 'open-lesson', lessonId: 'les_1' })
    const updated = view.send({ kind: 'ai' })
    expect(screen.getByText('Editor les_1')).toBeInTheDocument()
    expect(updated.consumeIntent).toHaveBeenCalled()
  })

  it('tells the editor whether the module is the visible one', () => {
    mount({ kind: 'open-lesson', lessonId: 'les_1' })
    expect(editorProps.at(-1)?.active).toBe(true)
  })
})

describe('DeckBuilderView: create-lesson from Home’s quick card', () => {
  const intent = {
    kind: 'create-lesson',
    request: { objectivesText: 'Know the Cold War', title: 'Cold War' }
  }

  it('makes the lesson, starting generation, then opens it', async () => {
    const create = vi.fn(async () => ok({ lessonId: 'les_made' }))
    mount(intent, create as never)
    expect(screen.getByRole('status', { name: 'Opening your lesson' })).toBeInTheDocument()
    expect(await screen.findByText('Editor les_made')).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ objectivesText: 'Know the Cold War', startGeneration: true })
    )
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('says what went wrong, with a way back', async () => {
    const view = mount(intent, (async () => fail('invalid-input', 'No objectives')) as never)
    expect(await screen.findByText('We couldn’t start your lesson.')).toBeInTheDocument()
    expect(screen.getByText('No objectives')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Home' }))
    expect(view.shell.navigate).toHaveBeenCalledWith('home')
  })

  it('says so when the call itself fails', async () => {
    mount(intent, (async () => {
      throw new Error('ipc')
    }) as never)
    await waitFor(() =>
      expect(screen.getByText('Something went wrong while making the lesson.')).toBeInTheDocument()
    )
  })
})
