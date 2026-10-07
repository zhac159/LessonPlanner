import { useRef, useState } from 'react'
import type { PluginInput, PluginSummary } from '@shared/contracts/deck-builder-plugins'
import type { GalleryGroup } from '../gallery'
import { EIGHT_SLIDES, MOCK_PLUGINS, QUIZ_MANIFEST } from './fixtures'
import { PluginMenu } from './PluginMenu/PluginMenu'
import { PluginSheet } from './PluginSheet/PluginSheet'
import { PluginTile } from './PluginTile/PluginTile'

const noop = (): void => {}

const SCOPED: PluginSummary[] = [
  ...MOCK_PLUGINS.slice(0, 2),
  { ...MOCK_PLUGINS[3], scope: 'slides', order: 10 },
  { ...MOCK_PLUGINS[1], id: 'rewrite', name: 'Rewrite', scope: 'region', order: 11 }
]

const MANY: PluginSummary[] = Array.from({ length: 9 }, (_, i) => ({
  ...MOCK_PLUGINS[i % MOCK_PLUGINS.length],
  id: `p${i}`,
  name: `${MOCK_PLUGINS[i % MOCK_PLUGINS.length].name} ${i + 1}`,
  order: i
}))

/** A "+" button and a menu above it, as the Composer will lay them out. */
function MenuDemo({
  plugins,
  unavailable
}: {
  plugins: PluginSummary[]
  unavailable?: (p: PluginSummary) => string | null
}) {
  const [open, setOpen] = useState(true)
  const plus = useRef<HTMLButtonElement>(null)
  return (
    <div style={{ position: 'relative', width: 420, paddingTop: 330 }}>
      <PluginMenu
        open={open}
        plugins={plugins}
        onSelect={noop}
        onManage={noop}
        onClose={() => setOpen(false)}
        unavailableReason={unavailable}
        returnFocusRef={plus}
      />
      <button
        ref={plus}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'relative' }}
      >
        + Plugins
      </button>
    </div>
  )
}

const sheet = (props: Partial<Parameters<typeof PluginSheet>[0]> = {}) => (
  <div style={{ width: 400, height: 760 }}>
    <PluginSheet
      manifest={QUIZ_MANIFEST}
      slides={EIGHT_SLIDES}
      onSubmit={noop}
      onBack={noop}
      onCancel={noop}
      {...props}
    />
  </div>
)

const TEXT_INPUTS: PluginInput[] = [
  { id: 'topic', type: 'text', label: 'Topic', placeholder: 'e.g. Chlorophyll', required: true },
  { id: 'extra', type: 'text', label: 'Extra instructions', multiline: true },
  { id: 'answers', type: 'boolean', label: 'Add an answer slide', default: true },
  {
    id: 'level',
    type: 'choice',
    label: 'Level',
    default: 'a',
    options: ['a', 'b', 'c', 'd', 'e'].map((v) => ({ value: v, label: `Level ${v.toUpperCase()}` }))
  }
]

const gallery: GalleryGroup = {
  title: 'Plugins',
  sections: [
    {
      name: 'PluginTile · tones, description, disabled, more',
      render: () => (
        <div
          role="menu"
          aria-label="Tiles"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 180px)', gap: 8 }}
        >
          {MOCK_PLUGINS.map((p) => (
            <PluginTile
              key={p.id}
              name={p.name}
              icon={p.icon}
              tone={p.tint}
              description={p.description}
            />
          ))}
          <PluginTile name="More plugins" icon="plus" tone="more" />
          <PluginTile
            name="Differentiate"
            icon="users"
            tone="sky"
            disabled
            disabledReason="Circle something first"
            description="Support and stretch versions"
          />
          <PluginTile
            name="Quiz"
            icon="list-checks"
            tone="peach"
            description="Quick-check questions in your format"
            showDescription
          />
        </div>
      )
    },
    {
      name: 'PluginMenu · five plugins (open)',
      render: () => <MenuDemo plugins={MOCK_PLUGINS} />
    },
    {
      name: 'PluginMenu · scopes, one unavailable',
      render: () => (
        <MenuDemo
          plugins={SCOPED}
          unavailable={(p) => (p.scope === 'region' ? 'Circle something first' : null)}
        />
      )
    },
    {
      name: 'PluginMenu · search (more than 8)',
      render: () => <MenuDemo plugins={MANY} />
    },
    { name: 'PluginSheet · Quiz (screen 07)', render: () => sheet() },
    {
      name: 'PluginSheet · multi-selection in the filmstrip',
      render: () => sheet({ slides: { total: 8, current: 3, selected: [3, 4, 5, 6, 7] } })
    },
    {
      name: 'PluginSheet · invalid, running, no key',
      render: () =>
        sheet({
          lastInputs: { types: [] },
          jobRunning: true,
          needsKey: true
        })
    },
    {
      name: 'PluginSheet · generated from text, boolean and select inputs',
      render: () =>
        sheet({
          manifest: {
            ...QUIZ_MANIFEST,
            title: 'Worksheet',
            action: 'Make worksheet',
            inputs: TEXT_INPUTS
          }
        })
    }
  ]
}

export default gallery
