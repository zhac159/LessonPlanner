import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gallery } from '../gallery'
import plugin from './gallery'

describe('plugin gallery specimens', () => {
  it('render without crashing and every section has a name', () => {
    render(<Gallery groups={[plugin]} />)
    expect(screen.getByRole('region', { name: plugin.title })).toBeInTheDocument()
    for (const section of plugin.sections) {
      expect(screen.getByRole('heading', { level: 3, name: section.name })).toBeInTheDocument()
    }
  })
})
