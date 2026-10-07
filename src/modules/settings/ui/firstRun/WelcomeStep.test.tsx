import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithApp } from '@test/render'
import { WelcomeStep, type WelcomeStepProps } from './WelcomeStep'

function setup(props: Partial<WelcomeStepProps> = {}) {
  const onNext = vi.fn<WelcomeStepProps['onNext']>(async () => null)
  const view = renderWithApp(
    <WelcomeStep initialName="Alice" initialSubject="" onNext={onNext} {...props} />
  )
  return { ...view, onNext }
}

const nameField = () => screen.getByLabelText('What should I call you?')
const subjectField = () => screen.getByLabelText('What do you mostly teach?')
const nextButton = () => screen.getByRole('button', { name: 'Next: connect Claude' })

afterEach(() => vi.useRealTimers())

describe('WelcomeStep content', () => {
  it('has the exact copy of the design', () => {
    setup()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Plan lessons in your own style.' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Show it the slides you’ve already made. Slide Planner learns how you teach, then builds new lessons from your learning objectives.'
      )
    ).toBeInTheDocument()
    const hero = screen.getByRole('list', { name: 'What Slide Planner does' })
    expect(hero).toHaveTextContent('Upload your old decks — PDF or PowerPoint')
    expect(hero).toHaveTextContent('Paste your learning objectives')
    expect(hero).toHaveTextContent('Refine by chatting — or just circle what to change')
    expect(screen.getByRole('heading', { level: 2, name: 'Welcome!' })).toBeInTheDocument()
    expect(
      screen.getByText('Let’s get you set up. It takes about two minutes.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Everything stays on this computer. No account needed. Files go to Claude only when you ask it to learn your style or make slides.'
      )
    ).toBeInTheDocument()
    expect(subjectField()).toHaveAttribute('placeholder', 'e.g. KS3 Science')
  })

  it('shows step 1 as current in the setup steps', () => {
    setup()
    const steps = screen.getByRole('list', { name: 'Setup steps' })
    const items = steps.querySelectorAll('li')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveAttribute('aria-current', 'step')
    expect(items[1]).not.toHaveAttribute('aria-current')
    expect(steps).toHaveTextContent('About you')
    expect(steps).toHaveTextContent('Connect Claude')
    expect(steps).toHaveTextContent('Your style (optional)')
  })

  it('hides the illustration from assistive technology', () => {
    const { container } = setup()
    const art = container.querySelector('.welcome-art')
    expect(art).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('WelcomeStep fields', () => {
  it('prefills the name, focuses it and selects its text so typing replaces it', async () => {
    const { user } = setup()
    expect(nameField()).toHaveValue('Alice')
    expect(nameField()).toHaveFocus()
    await user.keyboard('Bea')
    expect(nameField()).toHaveValue('Bea')
  })

  it('limits the name to 40 and the subject to 60 characters', () => {
    setup()
    expect(nameField()).toHaveAttribute('maxlength', '40')
    expect(subjectField()).toHaveAttribute('maxlength', '60')
  })

  it('disables Next when the name is empty or spaces and enables it with one character', async () => {
    const { user } = setup()
    await user.clear(nameField())
    expect(nextButton()).toBeDisabled()
    await user.type(nameField(), '   ')
    expect(nextButton()).toBeDisabled()
    await user.type(nameField(), 'B')
    expect(nextButton()).toBeEnabled()
  })

  it('shows the name error with aria-invalid only after the empty field loses focus', async () => {
    const { user } = setup()
    await user.clear(nameField())
    expect(screen.queryByText('Add your name so I know what to call you.')).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByText('Add your name so I know what to call you.')).toBeInTheDocument()
    expect(nameField()).toHaveAttribute('aria-invalid', 'true')
    await user.type(nameField(), 'C')
    expect(nameField()).not.toHaveAttribute('aria-invalid')
  })

  it('tabs from the name to the subject to Next', async () => {
    const { user } = setup()
    await user.tab()
    expect(subjectField()).toHaveFocus()
    await user.tab()
    expect(nextButton()).toHaveFocus()
  })
})

describe('WelcomeStep Next', () => {
  it('sends the trimmed name and subject', async () => {
    const { user, onNext } = setup()
    await user.clear(nameField())
    await user.type(nameField(), '  Ms Patel ')
    await user.type(subjectField(), ' KS3 Science ')
    await user.click(nextButton())
    expect(onNext).toHaveBeenCalledWith({ name: 'Ms Patel', subject: 'KS3 Science' })
  })

  it('Enter in either field presses Next when the name is valid', async () => {
    const { user, onNext } = setup()
    await user.type(subjectField(), 'Maths{Enter}')
    expect(onNext).toHaveBeenCalledTimes(1)
    await user.click(nameField())
    await user.keyboard('{Enter}')
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('Enter does nothing while the name is empty', async () => {
    const { user, onNext } = setup()
    await user.clear(nameField())
    await user.type(subjectField(), 'Maths{Enter}')
    expect(onNext).not.toHaveBeenCalled()
  })

  it('shows the save error under the button, keeps the values and re-enables Next', async () => {
    const onNext = vi.fn<WelcomeStepProps['onNext']>(async () => 'Couldn’t save that. Try again.')
    const { user } = setup({ onNext })
    await user.type(subjectField(), 'Art')
    await user.click(nextButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save that. Try again.')
    expect(nameField()).toHaveValue('Alice')
    expect(subjectField()).toHaveValue('Art')
    expect(nextButton()).toBeEnabled()
  })

  it('shows a spinner only when saving takes longer than 300 ms, and ignores a second click', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let finish: (error: string | null) => void = () => {}
    const onNext = vi.fn<WelcomeStepProps['onNext']>(
      () => new Promise((resolve) => (finish = resolve))
    )
    const { user } = setup({ onNext })
    await user.click(nextButton())
    expect(nextButton()).not.toHaveAttribute('aria-busy')
    await act(async () => void vi.advanceTimersByTime(350))
    expect(nextButton()).toHaveAttribute('aria-busy', 'true')
    await user.click(nextButton())
    expect(onNext).toHaveBeenCalledTimes(1)
    await act(async () => finish(null))
    expect(nextButton()).not.toHaveAttribute('aria-busy')
  })
})
