import { Upload } from 'lucide-react'
import type { Ref } from 'react'
import { Button } from '@ui/atoms'
import { PageHeader } from '@ui/chrome'
import { TextField } from '@ui/forms'

export interface LibraryHeaderProps {
  search: string
  onSearchChange(value: string): void
  searchRef?: Ref<HTMLInputElement>
  onUpload(): void
  uploading?: boolean
}

/** "Your assets", its lead line, the search field (`/` focuses it) and the primary Upload button. */
export function LibraryHeader({
  search,
  onSearchChange,
  searchRef,
  onUpload,
  uploading = false
}: LibraryHeaderProps) {
  return (
    <PageHeader
      variant="greeting"
      title="Your assets"
      subtitle="Logos, icons and pictures you use again and again. Add them to any lesson with + › Add asset."
      actions={
        <>
          <TextField
            ref={searchRef}
            variant="search"
            label="Search your assets"
            hideLabel
            placeholder="Search: logo, beaker, owl…"
            className="as-page__search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <Button
            variant="primary"
            icon={<Upload strokeWidth={2.4} />}
            loading={uploading}
            loadingLabel="Adding…"
            onClick={onUpload}
          >
            Upload
          </Button>
        </>
      }
    />
  )
}
