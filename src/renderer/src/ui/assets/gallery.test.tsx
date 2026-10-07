import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gallery } from '../gallery'
import gallery from './gallery'

describe('assets gallery specimens', () => {
  it('has the title "Assets" and uniquely named sections', () => {
    expect(gallery.title).toBe('Assets')
    const names = gallery.sections.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('covers every component of the kit', () => {
    const covered = gallery.sections.map((s) => s.name).join('\n')
    for (const component of [
      'AssetChip',
      'AssetTile',
      'AssetCard',
      'AssetGrid',
      'FilterPills',
      'SelectionBar',
      'LicenceBadge',
      'FitControl',
      'AssetSheet',
      'SegmentedTabs',
      'PickerSheet',
      'AssetPicker',
      'SpotMark',
      'SpotsCard',
      'PictureSpotBadge',
      'RegionActionBar',
      'AssetNameTag',
      'OnlineResultCard',
      'OnlineDetail',
      'AssetDetailPanel',
      'ReviewRow',
      'ReviewFileRow',
      'MakeNewPanel',
      'VersionPicker',
      'KeepForm',
      'BasedOnStrip'
    ]) {
      expect(covered, component).toContain(component)
    }
  })

  it('renders every section with its heading', () => {
    render(<Gallery groups={[gallery]} />)
    expect(screen.getByRole('region', { name: gallery.title })).toBeInTheDocument()
    for (const section of gallery.sections) {
      expect(screen.getByRole('heading', { level: 3, name: section.name })).toBeInTheDocument()
    }
  })

  it.each(gallery.sections.map((s) => [s.name, s] as const))(
    '%s: every button and field has an accessible name',
    (_name, section) => {
      const { container } = render(<>{section.render()}</>)
      expect(container.children.length).toBeGreaterThan(0)
      for (const button of container.querySelectorAll('button')) {
        const named = button.textContent?.trim() || button.getAttribute('aria-label')
        expect(named, `${button.outerHTML} needs an accessible name`).toBeTruthy()
      }
      for (const control of container.querySelectorAll('input, select, textarea')) {
        const el = control as HTMLInputElement
        const labelled =
          el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
        expect(labelled, `${el.outerHTML} needs an accessible name`).toBeTruthy()
      }
      for (const img of container.querySelectorAll('img')) {
        expect(img.getAttribute('alt'), 'pictures beside a title have empty alt').toBe('')
      }
    }
  )
})
