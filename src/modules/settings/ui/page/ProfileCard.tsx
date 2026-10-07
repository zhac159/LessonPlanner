import { useState, type KeyboardEvent } from 'react'
import { Card } from '@ui/atoms'
import { TextField } from '@ui/forms'
import type { UserProfile } from '@shared/contracts/settings'
import type { ProfileState } from '../hooks/useProfile'
import './page.css'

export interface ProfileCardProps {
  profile: UserProfile
  save: ProfileState['save']
}

/** Settings › About you: the name and subject, saved when a field loses focus or Enter is pressed. */
export function ProfileCard({ profile, save }: ProfileCardProps) {
  const [name, setName] = useState(profile.name ?? '')
  const [subject, setSubject] = useState(profile.subject ?? '')
  const [error, setError] = useState<string | undefined>()
  const [saved, setSaved] = useState(false)

  const commit = async (): Promise<void> => {
    const patch: { name?: string; subject?: string | null } = {}
    if (name.trim() !== (profile.name ?? '')) patch.name = name
    if (subject.trim() !== (profile.subject ?? '')) patch.subject = subject.trim() || null
    if (Object.keys(patch).length === 0) return
    const result = await save(patch)
    setError(result.ok ? undefined : result.message)
    setSaved(result.ok)
    if (result.ok) {
      setName(result.profile.name ?? '')
      setSubject(result.profile.subject ?? '')
    }
  }

  const onEnter = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') void commit()
  }

  return (
    <Card
      as="section"
      variant="page"
      padding={32}
      className="settings__card"
      aria-labelledby="settings-about"
    >
      <h2 id="settings-about" className="settings__card-title">
        About you
      </h2>
      <TextField
        label="What should I call you?"
        strongValue
        value={name}
        maxLength={40}
        error={error}
        onChange={(event) => {
          setName(event.target.value)
          setSaved(false)
        }}
        onBlur={() => void commit()}
        onKeyDown={onEnter}
        autoComplete="off"
      />
      <TextField
        label="What do you mostly teach?"
        value={subject}
        maxLength={60}
        placeholder="e.g. KS3 Science"
        onChange={(event) => {
          setSubject(event.target.value)
          setSaved(false)
        }}
        onBlur={() => void commit()}
        onKeyDown={onEnter}
        autoComplete="off"
      />
      <p className="settings__saved" role="status">
        {saved ? 'Saved' : ''}
      </p>
    </Card>
  )
}
