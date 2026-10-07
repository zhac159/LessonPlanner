import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gallery } from '../gallery'
import atoms from './gallery'
import chrome from '../chrome/gallery'
import overlays from '../overlays/gallery'

describe.each([
  ['atoms', atoms],
  ['chrome', chrome],
  ['overlays', overlays]
])('%s gallery specimens', (_name, group) => {
  it('render without crashing and every section has a name', () => {
    render(<Gallery groups={[group]} />)
    expect(screen.getByRole('region', { name: group.title })).toBeInTheDocument()
    for (const section of group.sections) {
      expect(section.name.length).toBeGreaterThan(0)
      expect(screen.getByRole('heading', { level: 3, name: section.name })).toBeInTheDocument()
    }
  })
})
