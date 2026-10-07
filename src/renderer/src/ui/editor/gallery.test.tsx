import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gallery } from '../gallery'
import editor from './gallery'

describe('editor gallery specimens', () => {
  it('render without crashing and every section has a name', () => {
    render(<Gallery groups={[editor]} />)
    expect(screen.getByRole('region', { name: editor.title })).toBeInTheDocument()
    for (const section of editor.sections) {
      expect(screen.getByRole('heading', { level: 3, name: section.name })).toBeInTheDocument()
    }
  })
})
