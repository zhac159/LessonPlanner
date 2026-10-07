import { useState } from 'react'
import { useClient, useShell } from '@renderer/sdk'
import { APP_CONFIG } from '@shared/appConfig'
import { SETTINGS, type SettingsApi } from '@shared/contracts/settings'
import { useToast } from '@ui/overlays'
import { ConnectStep } from '../connect/ConnectStep'
import { useConnectClaude } from '../hooks/useConnectClaude'
import { usePictureMaker } from '../hooks/usePictureMaker'
import { SAVE_FAILED, type ProfileState } from '../hooks/useProfile'
import { WelcomeStep } from './WelcomeStep'

export interface FirstRunWizardProps {
  profile: ProfileState['profile']
  saveProfile: ProfileState['save']
  /** The wizard is over (skipped or finished); the caller restores the normal chrome. */
  onDone(): void
}

/**
 * The first-run wizard: Welcome, then Connect Claude. Switching steps is local state, not navigation
 * (design/screens/01-welcome.md §2). Resumes at the saved step and ends on Home or Create a style.
 */
export function FirstRunWizard({ profile, saveProfile, onDone }: FirstRunWizardProps) {
  const settings = useClient<SettingsApi>(SETTINGS)
  const { navigate, modules, refreshUser } = useShell()
  const toast = useToast()
  const claude = useConnectClaude()
  const picture = usePictureMaker()
  const [step, setStep] = useState<'about' | 'connect'>(
    profile?.onboarding.step === 'connect' ? 'connect' : 'about'
  )

  const saveAbout = async (values: { name: string; subject: string }): Promise<string | null> => {
    try {
      const saved = await saveProfile({ name: values.name, subject: values.subject || null })
      if (!saved.ok) return SAVE_FAILED
      await settings.setOnboardingStep('connect')
      setStep('connect')
      return null
    } catch {
      return SAVE_FAILED
    }
  }

  const finish = async (skippedAi: boolean): Promise<void> => {
    try {
      await settings.completeOnboarding({ skippedAi })
    } catch {
      toast.show({ message: SAVE_FAILED, tone: 'error' })
      return
    }
    await refreshUser()
    onDone()
    if (skippedAi || !modules.some((m) => m.id === 'style-library')) navigate('home')
    else navigate('style-library', { kind: 'new-style', firstRun: true })
  }

  if (step === 'about') {
    return (
      <WelcomeStep
        initialName={profile?.name ?? APP_CONFIG.userName}
        initialSubject={profile?.subject ?? ''}
        onNext={saveAbout}
      />
    )
  }
  return (
    <ConnectStep
      claude={claude}
      picture={picture}
      onBack={() => setStep('about')}
      onSkip={() => void finish(true)}
      onContinue={() => void finish(false)}
    />
  )
}
