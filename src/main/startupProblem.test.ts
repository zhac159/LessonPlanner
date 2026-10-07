import { beforeEach, describe, expect, it, vi } from 'vitest'

const answers: number[] = []
const showMessageBox = vi.fn(async (_options: Record<string, unknown>) => ({
  response: answers.shift() ?? 0
}))
vi.mock('electron', () => ({
  dialog: { showMessageBox: (o: Record<string, unknown>) => showMessageBox(o) }
}))

const { dataFolderNotice, describeProblem, showProblem } = await import('./startupProblem')
const { DataFolderError } = await import('./services/paths')

beforeEach(() => {
  showMessageBox.mockClear()
  answers.length = 0
})

describe('describeProblem', () => {
  it('names the folder in plain English for an unusable data folder', () => {
    const problem = describeProblem(
      new DataFolderError('C:\\Program Files\\Slide Planner\\data', 'EACCES: denied', false)
    )
    expect(problem.severity).toBe('error')
    expect(problem.message).toContain(
      'Slide Planner can’t save your lessons in C:\\Program Files\\Slide Planner\\data.'
    )
    expect(problem.message).not.toContain('EACCES')
    expect(problem.details).toContain('EACCES: denied')
  })

  it('words an explicit folder differently', () => {
    const problem = describeProblem(new DataFolderError('E:\\mine', 'ENOENT', true))
    expect(problem.message).toContain('told to use')
  })

  it('keeps the technical error out of the message of any other startup failure', () => {
    const problem = describeProblem(new TypeError('Cannot read properties of undefined'))
    expect(problem.message).toContain('Something went wrong while Slide Planner was starting')
    expect(problem.message).not.toContain('TypeError')
    expect(problem.details).toContain('Cannot read properties of undefined')
  })

  it('copes with a thrown string', () => {
    expect(describeProblem('boom').details).toBe('boom')
  })
})

describe('dataFolderNotice', () => {
  it('is a warning that says where the lessons go instead', () => {
    const notice = dataFolderNotice(
      'C:\\wanted',
      'C:\\Users\\t\\AppData\\Local\\Slide Planner\\data',
      'EPERM'
    )
    expect(notice.severity).toBe('warning')
    expect(notice.message).toContain('can’t save your lessons in C:\\wanted')
    expect(notice.message).toContain('AppData\\Local\\Slide Planner\\data')
    expect(notice.details).toContain('EPERM')
  })
})

describe('showProblem', () => {
  const problem = describeProblem(new Error('kaput'))

  it('shows one dialog when the details are not asked for', async () => {
    answers.push(0)
    await showProblem(problem)
    expect(showMessageBox).toHaveBeenCalledTimes(1)
    expect(showMessageBox.mock.calls[0][0]).toMatchObject({
      type: 'error',
      buttons: ['Close', 'Show details']
    })
  })

  it('shows the technical details in a second dialog on request', async () => {
    answers.push(1)
    await showProblem(problem)
    expect(showMessageBox).toHaveBeenCalledTimes(2)
    expect(String(showMessageBox.mock.calls[1][0].detail)).toContain('kaput')
  })

  it('uses OK for a notice', async () => {
    answers.push(0)
    await showProblem(dataFolderNotice('a', 'b', 'c'))
    expect(showMessageBox.mock.calls[0][0]).toMatchObject({
      type: 'warning',
      buttons: ['OK', 'Show details']
    })
  })
})
