import { Plus } from 'lucide-react'
import { Button } from '@ui/atoms'
import { PageHeader } from '@ui/chrome'
import { TextField } from '@ui/forms'
import type { HomeSearch } from '../hooks/useHomeSearch'

export interface HomeHeaderProps {
  greeting: string
  search: HomeSearch
  onNewLesson(): void
}

/** Greeting, the page search (Ctrl+F) and the "New lesson" button. */
export function HomeHeader({ greeting, search, onNewLesson }: HomeHeaderProps) {
  return (
    <PageHeader
      variant="greeting"
      title={greeting}
      subtitle="What are we teaching today?"
      actions={
        <>
          <TextField
            ref={search.inputRef}
            variant="search"
            label="Search lessons and styles"
            hideLabel
            placeholder="Search lessons and styles"
            className="home-search"
            value={search.value}
            onChange={(event) => search.setValue(event.target.value)}
            onKeyDown={search.onKeyDown}
          />
          <Button variant="primary" icon={<Plus strokeWidth={2.4} />} onClick={onNewLesson}>
            New lesson
          </Button>
        </>
      }
    />
  )
}
