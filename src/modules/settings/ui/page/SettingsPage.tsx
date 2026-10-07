import { useEffect, useRef } from 'react'
import { useClient, useShell } from '@renderer/sdk'
import { SETTINGS, type SettingsApi } from '@shared/contracts/settings'
import { PageHeader } from '@ui/chrome'
import { useConnectClaude } from '../hooks/useConnectClaude'
import { usePictureMaker } from '../hooks/usePictureMaker'
import type { ProfileState } from '../hooks/useProfile'
import { useUsage } from '../hooks/useUsage'
import { AiCard } from './AiCard'
import { ProfileCard } from './ProfileCard'
import './page.css'

export interface SettingsPageProps {
  profile: ProfileState['profile']
  saveProfile: ProfileState['save']
  /** Bumps each time `{ kind: 'ai' }` is requested: moves focus to the Claude card. */
  focusAiSignal: number
}

/** The Settings page: About you and Claude (Settings › AI). Everything saves as soon as it changes. */
export function SettingsPage({ profile, saveProfile, focusAiSignal }: SettingsPageProps) {
  const settings = useClient<SettingsApi>(SETTINGS)
  const { refreshUser } = useShell()
  const claude = useConnectClaude()
  const picture = usePictureMaker()
  const usage = useUsage(claude.status?.lastTest?.at ?? claude.status?.hasKey)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusAiSignal === 0) return
    heading.current?.focus()
    heading.current?.scrollIntoView?.({ block: 'start' })
  }, [focusAiSignal])

  const save: ProfileState['save'] = async (patch) => {
    const result = await saveProfile(patch)
    if (result.ok) await refreshUser()
    return result
  }

  const removeKey = async (): Promise<void> => {
    await settings.removeApiKey()
    await claude.refreshStatus()
    await refreshUser()
  }

  return (
    <div className="settings">
      <PageHeader variant="bar" title="Settings" />
      <div className="settings__column">
        {profile && <ProfileCard profile={profile} save={save} />}
        <AiCard
          claude={claude}
          picture={picture}
          usage={usage}
          onRemoveKey={removeKey}
          headingRef={heading}
        />
      </div>
    </div>
  )
}
