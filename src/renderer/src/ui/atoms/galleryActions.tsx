import { ArrowRight, Paperclip, Play, Plus, X } from 'lucide-react'
import type { GallerySection } from '../gallery'
import { Button } from './Button/Button'
import { IconButton } from './IconButton/IconButton'
import { TextLink } from './TextLink/TextLink'
import { Tooltip } from './Tooltip/Tooltip'

const VARIANTS = ['primary', 'dark', 'secondary', 'ghost'] as const
const SIZES = ['sm', 'md', 'lg', 'xl'] as const

/** Specimens for the interactive atoms: buttons, icon buttons, links, tooltips. */
export const actionSections: GallerySection[] = [
  {
    name: 'Button · variants × sizes',
    render: () => (
      <div style={{ display: 'grid', gap: 12 }}>
        {VARIANTS.map((variant) => (
          <div key={variant} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {variant} {size}
              </Button>
            ))}
          </div>
        ))}
      </div>
    )
  },
  {
    name: 'Button · icons and shapes',
    render: () => (
      <>
        <Button variant="primary" icon={<Plus strokeWidth={2.4} />}>
          New lesson
        </Button>
        <Button variant="dark" size="lg" iconAfter={<ArrowRight strokeWidth={2.4} />}>
          Create lesson
        </Button>
        <Button shape="pill" icon={<Paperclip />}>
          Attach
        </Button>
        <Button variant="secondary" icon={<Play />}>
          Present
        </Button>
      </>
    )
  },
  {
    name: 'Button · disabled, aria-disabled, loading',
    render: () => (
      <>
        <Button variant="primary" disabled>
          Export
        </Button>
        <Button variant="secondary" disabled>
          Present
        </Button>
        <Button variant="dark" disabled>
          Send
        </Button>
        <Button variant="ghost" disabled>
          Ghost
        </Button>
        <Button variant="secondary" aria-disabled="true">
          Needs slides
        </Button>
        <Button variant="primary" loading loadingLabel="Making quiz…">
          Make quiz
        </Button>
      </>
    )
  },
  {
    name: 'IconButton · round, square, ghost, toggled, disabled',
    render: () => (
      <>
        <IconButton aria-label="Add a plugin">
          <Plus strokeWidth={2.4} />
        </IconButton>
        <IconButton aria-label="Attach a file">
          <Paperclip />
        </IconButton>
        <IconButton aria-label="Add" variant="square">
          <Plus />
        </IconButton>
        <IconButton aria-label="Remove file" variant="ghost">
          <X strokeWidth={2.2} />
        </IconButton>
        <IconButton aria-label="Plugins" aria-expanded="true">
          <Plus strokeWidth={2.4} />
        </IconButton>
        <IconButton aria-label="Disabled" disabled>
          <Plus />
        </IconButton>
      </>
    )
  },
  {
    name: 'TextLink and Tooltip',
    render: () => (
      <>
        <TextLink>Skip for now</TextLink>
        <TextLink disabled>Disabled link</TextLink>
        <Tooltip label="Add a plugin">
          <IconButton aria-label="Add a plugin">
            <Plus strokeWidth={2.4} />
          </IconButton>
        </Tooltip>
      </>
    )
  }
]
