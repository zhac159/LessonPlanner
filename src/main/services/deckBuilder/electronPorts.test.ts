import { describe, expect, it, vi } from 'vitest'
import {
  createDialogPort,
  createFullScreenPort,
  createOpenerPort,
  createTrashPort,
  testAnswer,
  type DialogLike
} from './electronPorts'

function fakeDialog(over: Partial<{ save: string | undefined; open: string[] }> = {}) {
  const calls: Array<{ kind: 'save' | 'open'; options: Record<string, unknown> }> = []
  const dialog: DialogLike = {
    showSaveDialog: async (_window, options) => {
      calls.push({ kind: 'save', options })
      return { canceled: over.save === undefined, filePath: over.save }
    },
    showOpenDialog: async (_window, options) => {
      calls.push({ kind: 'open', options })
      return { canceled: !over.open?.length, filePaths: over.open ?? [] }
    }
  }
  return { dialog, calls }
}

const base = { window: () => null, documentsDir: () => 'C:\\Users\\Alice\\Documents' }

describe('testAnswer', () => {
  it('is null outside test mode, so a real dialog opens', () => {
    expect(
      testAnswer({ SLIDE_PLANNER_TEST_SAVE_PATH: 'x' }, 'SLIDE_PLANNER_TEST_SAVE_PATH')
    ).toBeNull()
  })

  it('answers with the variable in test mode, and undefined (cancelled) when it is empty', () => {
    const env = { SLIDE_PLANNER_TEST: '1', A: ' C:/tmp/a.pptx ', B: '  ' }
    expect(testAnswer(env, 'A')).toBe('C:/tmp/a.pptx')
    expect(testAnswer(env, 'B')).toBeUndefined()
    expect(testAnswer(env, 'MISSING')).toBeUndefined()
  })
})

describe('createDialogPort', () => {
  it('Save: starts in Documents with the suggested name and a .pptx filter', async () => {
    const { dialog, calls } = fakeDialog({ save: 'C:\\x\\Lesson.pptx' })
    const port = createDialogPort({ ...base, dialog, env: {} })
    expect(await port.pickSavePath('Lesson.pptx')).toBe('C:\\x\\Lesson.pptx')
    expect(calls[0].options).toMatchObject({
      defaultPath: 'C:\\Users\\Alice\\Documents\\Lesson.pptx',
      filters: [{ extensions: ['pptx'] }]
    })
  })

  it('Save: undefined when the teacher cancels', async () => {
    const { dialog } = fakeDialog()
    expect(
      await createDialogPort({ ...base, dialog, env: {} }).pickSavePath('a.pptx')
    ).toBeUndefined()
  })

  it('Open: passes the title and extensions, returns the first file or undefined', async () => {
    const { dialog, calls } = fakeDialog({ open: ['C:\\a.docx', 'C:\\b.docx'] })
    const port = createDialogPort({ ...base, dialog, env: {} })
    expect(await port.pickOpenPath({ title: 'Attach', extensions: ['docx', 'pdf'] })).toBe(
      'C:\\a.docx'
    )
    expect(calls[0].options).toMatchObject({
      title: 'Attach',
      properties: ['openFile'],
      filters: [{ extensions: ['docx', 'pdf'] }]
    })
    const none = createDialogPort({ ...base, dialog: fakeDialog().dialog, env: {} })
    expect(await none.pickOpenPath({ title: 'x', extensions: [] })).toBeUndefined()
  })

  it('in test mode answers from the environment and never opens a dialog', async () => {
    const { dialog, calls } = fakeDialog()
    const env = {
      SLIDE_PLANNER_TEST: '1',
      SLIDE_PLANNER_TEST_SAVE_PATH: 'C:/tmp/out.pptx',
      SLIDE_PLANNER_TEST_OPEN_PATH: 'C:/tmp/in.pdf'
    }
    const port = createDialogPort({ ...base, dialog, env })
    expect(await port.pickSavePath('a.pptx')).toBe('C:/tmp/out.pptx')
    expect(await port.pickOpenPath({ title: 't', extensions: ['pdf'] })).toBe('C:/tmp/in.pdf')
    expect(calls).toEqual([])
  })
})

describe('the small adapters', () => {
  it('trash and opener forward to the shell', async () => {
    const shell = {
      trashItem: vi.fn(async () => undefined),
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn()
    }
    await createTrashPort(shell).trashItem('C:\\a')
    expect(await createOpenerPort(shell).openPath('C:\\b.pptx')).toBe('')
    createOpenerPort(shell).showItemInFolder('C:\\b.pptx')
    expect(shell.trashItem).toHaveBeenCalledWith('C:\\a')
    expect(shell.openPath).toHaveBeenCalledWith('C:\\b.pptx')
    expect(shell.showItemInFolder).toHaveBeenCalledWith('C:\\b.pptx')
  })

  it('full screen goes to the main window and is a no-op without one', () => {
    const win = { setFullScreen: vi.fn() }
    createFullScreenPort(() => win).setFullScreen(true)
    expect(win.setFullScreen).toHaveBeenCalledWith(true)
    expect(() => createFullScreenPort(() => null).setFullScreen(false)).not.toThrow()
  })
})
