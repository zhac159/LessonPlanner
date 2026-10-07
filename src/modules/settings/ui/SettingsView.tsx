import { useEffect, useState } from 'react'
import { useShell, type ModuleViewProps } from '@renderer/sdk'
import { FirstRunWizard } from './firstRun/FirstRunWizard'
import { useProfile } from './hooks/useProfile'
import { SettingsPage } from './page/SettingsPage'

/**
 * The settings module's page: the first-run wizard (intent `{ kind: 'first-run' }`, or whenever setup is
 * not finished) or the Settings page (intent `{ kind: 'ai' }` moves focus to the Claude card). While the
 * wizard shows, the window has no sidebar (chrome `none`).
 */
export function SettingsView({ active }: ModuleViewProps) {
  const { intent, consumeIntent, setChrome } = useShell()
  const { loaded, profile, save } = useProfile()
  const [wizard, setWizard] = useState<boolean | null>(null)
  const [focusAiSignal, setFocusAiSignal] = useState(0)

  useEffect(() => {
    // A page that is mounted but hidden must not take (consume) an intent meant for the page being opened.
    if (!intent || !active) return
    if (intent.kind === 'first-run') setWizard(true)
    else if (intent.kind === 'ai') {
      setWizard((current) => current ?? false)
      setFocusAiSignal((n) => n + 1)
    }
    consumeIntent()
  }, [active, intent, consumeIntent])

  const showWizard = wizard ?? (profile !== null && profile.onboarding.step !== 'done')

  useEffect(() => {
    if (!active || !showWizard) return
    setChrome('none')
    return () => setChrome(null)
  }, [active, showWizard, setChrome])

  if (!loaded) return null
  if (showWizard) {
    return <FirstRunWizard profile={profile} saveProfile={save} onDone={() => setWizard(false)} />
  }
  return <SettingsPage profile={profile} saveProfile={save} focusAiSignal={focusAiSignal} />
}
