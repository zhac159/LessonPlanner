import { Blocks, House, Palette, Play, Plus, SlidersHorizontal } from 'lucide-react'
import type { GalleryGroup } from '../gallery'
import { Button } from '../atoms/Button/Button'
import { ProgressPills } from '../atoms/ProgressPills/ProgressPills'
import { StatusPill } from '../atoms/StatusPill/StatusPill'
import { AppMark } from './AppMark/AppMark'
import { PageHeader } from './PageHeader/PageHeader'
import { Sidebar, type SidebarItem } from './Sidebar/Sidebar'
import { TitleBar } from './TitleBar/TitleBar'

const noop = (): void => {}
const ITEMS: SidebarItem[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'styles', label: 'Styles', icon: Palette },
  { id: 'plugins', label: 'Plugins', icon: Blocks },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal, placement: 'bottom' }
]
const USER = { name: 'Alice', status: 'Claude connected' }

const bar = (props: Partial<Parameters<typeof TitleBar>[0]>) => (
  <div style={{ width: 640, height: 40, position: 'relative' }}>
    <TitleBar
      title="Slide Planner"
      maximized={false}
      onMinimize={noop}
      onToggleMaximize={noop}
      onClose={noop}
      {...props}
    />
  </div>
)

const gallery: GalleryGroup = {
  title: 'Chrome',
  sections: [
    { name: 'AppMark', render: () => <AppMark /> },
    {
      name: 'TitleBar · default, maximised, inactive, floating',
      render: () => (
        <div style={{ display: 'grid', gap: 12 }}>
          {bar({})}
          {bar({ maximized: true })}
          {bar({ inactive: true })}
          {bar({ floating: true })}
        </div>
      )
    },
    {
      name: 'Sidebar · full (Home current) and rail (focus mode)',
      render: () => (
        <>
          <div style={{ height: 420 }}>
            <Sidebar items={ITEMS} activeId="home" user={USER} onNavigate={noop} />
          </div>
          <div style={{ height: 420 }}>
            <Sidebar
              items={ITEMS}
              activeId="home"
              current="true"
              mode="rail"
              user={USER}
              onNavigate={noop}
            />
          </div>
          <div style={{ height: 420 }}>
            <Sidebar
              items={ITEMS}
              activeId="styles"
              user={{ name: 'Alice', status: 'Claude isn’t connected' }}
              onNavigate={noop}
            />
          </div>
        </>
      )
    },
    {
      name: 'PageHeader · greeting, bar, editor, steps',
      render: () => (
        <div style={{ display: 'grid', gap: 28, width: '100%' }}>
          <PageHeader
            variant="greeting"
            title="Good morning, Alice!"
            subtitle="What are we teaching today?"
            actions={
              <Button variant="primary" icon={<Plus strokeWidth={2.4} />}>
                New lesson
              </Button>
            }
          />
          <PageHeader
            variant="bar"
            title="Create a style"
            back={{ label: 'Home', onClick: noop }}
            status={
              <StatusPill tone="working" size="lg">
                Learning · 6 of 8 files
              </StatusPill>
            }
            actions={<Button variant="primary">Save style</Button>}
          />
          <PageHeader
            variant="editor"
            back={{ label: 'My lessons', onClick: noop }}
            center="Y8 Science — Photosynthesis"
            actions={
              <>
                <Button icon={<Play />}>Present</Button>
                <Button variant="primary">Export to PowerPoint</Button>
              </>
            }
          />
          <PageHeader
            variant="steps"
            actions={
              <ProgressPills
                steps={[
                  { id: 'about', label: 'About you' },
                  { id: 'claude', label: 'Connect Claude' },
                  { id: 'style', label: 'Your style' }
                ]}
                current={1}
              />
            }
          />
        </div>
      )
    }
  ]
}

export default gallery
