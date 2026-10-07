import { useId, type FormEvent } from 'react'
import { Button } from '../../atoms/Button/Button'
import { cx } from '../../atoms/cx'
import { TextField } from '../../forms/TextField/TextField'
import './OnlineSearch.css'

export interface OnlineSearchBarProps {
  value: string
  onChange: (value: string) => void
  /** Enter or the Search button. */
  onSearch: () => void
  busy?: boolean
  placeholder?: string
  /** A9 = a 52 px field; A13 = the same row at 44 px inside the sheet. */
  size?: 'lg' | 'md'
  className?: string
}

/** The search row: a field with a magnifier and the dark "Search" button. Enter searches too. */
export function OnlineSearchBar({
  value,
  onChange,
  onSearch,
  busy = false,
  placeholder = 'Search free image libraries',
  size = 'lg',
  className
}: OnlineSearchBarProps) {
  const id = useId()
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (value.trim() && !busy) onSearch()
  }
  return (
    <form
      role="search"
      aria-label="Find images online"
      className={cx('as-online-bar', className)}
      onSubmit={submit}
    >
      <TextField
        id={id}
        label="Search free image libraries"
        hideLabel
        variant="search"
        size={size === 'lg' ? 'xl' : 'md'}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button
        type="submit"
        variant="dark"
        size={size === 'lg' ? 'xl' : 'md'}
        loading={busy}
        loadingLabel="Searching…"
        aria-disabled={value.trim() ? undefined : true}
      >
        Search
      </Button>
    </form>
  )
}
