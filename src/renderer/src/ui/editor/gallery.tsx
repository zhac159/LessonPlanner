import { Lasso } from 'lucide-react'
import { useState } from 'react'
import type { StrokePath } from '@shared/contracts/deck-builder-chat'
import type { GalleryGroup } from '../gallery'
import { RegionLabel } from './RegionLabel/RegionLabel'
import { RegionOverlay, type OverlayRegion } from './RegionOverlay/RegionOverlay'
import { ToolButton } from './ToolButton/ToolButton'
import { ToolRail } from './ToolRail/ToolRail'
import type { EditorTool } from './ToolRail/tools'

const noop = (): void => {}

/** An egg-shaped loop around the picture area of the mock-up slide, in slide units. */
const LOOP: StrokePath = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2
  return [1220 + Math.cos(angle) * 360, 560 + Math.sin(angle) * 330] as [number, number]
})

function RailDemo({ orientation }: { orientation?: 'vertical' | 'horizontal' }) {
  const [tool, setTool] = useState<EditorTool>('circle')
  return (
    <ToolRail
      tool={tool}
      onToolChange={setTool}
      canUndo
      canRedo={false}
      onUndo={noop}
      onRedo={noop}
      orientation={orientation}
      shortcuts={false}
    />
  )
}

/** A stage-shaped box with the overlay on top; drawing adds numbered regions. */
function OverlayDemo({ initial, active }: { initial: OverlayRegion[]; active: boolean }) {
  const [regions, setRegions] = useState(initial)
  return (
    <div
      style={{
        position: 'relative',
        width: 560,
        aspectRatio: '16 / 9',
        border: '2px solid var(--ink)',
        background: 'var(--surface-sunken)'
      }}
    >
      <RegionOverlay
        active={active}
        regions={regions}
        activeRegionId={regions.find((r) => r.linked)?.id ?? null}
        onComplete={(path) =>
          setRegions((all) => [
            ...all,
            { id: `r${all.length + 1}`, n: Math.max(0, ...all.map((r) => r.n)) + 1, path }
          ])
        }
        onRemoveRegion={(id) => setRegions((all) => all.filter((r) => r.id !== id))}
      />
    </div>
  )
}

const gallery: GalleryGroup = {
  title: 'Editor tools',
  sections: [
    {
      name: 'ToolButton · idle, pressed, disabled',
      render: () => (
        <div style={{ display: 'flex', gap: 8 }}>
          <ToolButton label="Circle to edit" icon={Lasso} pressed={false} />
          <ToolButton label="Circle to edit" icon={Lasso} pressed />
          <ToolButton label="Undo" icon={Lasso} disabled />
        </div>
      )
    },
    { name: 'ToolRail · vertical', render: () => <RailDemo /> },
    { name: 'ToolRail · horizontal', render: () => <RailDemo orientation="horizontal" /> },
    {
      name: 'RegionLabel · drafting, summary, busy, removable, linked',
      render: () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <RegionLabel n={1} />
          <RegionLabel n={2} text="Swap for a diagram" />
          <RegionLabel n={3} text="Make it bigger" busy />
          <RegionLabel n={4} onRemove={noop} />
          <RegionLabel n={5} linked />
        </div>
      )
    },
    {
      name: 'RegionOverlay · one region with its label',
      render: () => (
        <OverlayDemo
          active={false}
          initial={[{ id: 'a', n: 1, path: LOOP, caption: 'Swap for a diagram' }]}
        />
      )
    },
    {
      name: 'RegionOverlay · linked and dimmed outside',
      render: () => (
        <OverlayDemo active={false} initial={[{ id: 'a', n: 1, path: LOOP, linked: true }]} />
      )
    },
    {
      name: 'RegionOverlay · circle tool on (draw with the pointer or arrows and Enter)',
      render: () => <OverlayDemo active initial={[]} />
    }
  ]
}

export default gallery
