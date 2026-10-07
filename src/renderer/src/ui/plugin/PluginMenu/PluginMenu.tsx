import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'
import { cx } from '../../atoms/cx'
import { TextLink } from '../../atoms/TextLink/TextLink'
import { TextField } from '../../forms/TextField/TextField'
import { PluginTile } from '../PluginTile/PluginTile'
import { ADD_ASSET_NAME, AddAssetTile } from './AddAssetTile'
import { groupPlugins, matchesSearch } from './groups'
import { menuFocusTarget, typeaheadMatch } from './menuNav'
import './PluginMenu.css'

export interface PluginMenuProps {
  open: boolean
  /** Enabled plugins from `plugins:list`. They are shown in `order`, grouped by scope. */
  plugins: PluginSummary[]
  /** A tile was chosen. The menu then closes itself. */
  onSelect: (plugin: PluginSummary) => void
  /** Asked to close: Esc, a click outside, Tab away, or after a choice. */
  onClose: () => void
  /** "Manage" or "More plugins" was chosen: open the Plugins page. The menu then closes. */
  onManage: () => void
  /** Why a plugin cannot run right now ("Circle something first"); null when it can. */
  unavailableReason?: (plugin: PluginSummary) => string | null
  /** The "+" button: Esc returns focus here and clicks on it do not count as outside. */
  returnFocusRef?: RefObject<HTMLElement | null>
  /**
   * The built-in "Add asset" tile above the plugins (not a plugin: it is never in Manage). With it the menu is titled
   * "What shall we add?" and the plugins sit under "MAKE WITH CLAUDE".
   */
  addAsset?: { onChoose: () => void; showNew: boolean; disabled?: boolean }
  /** More plugins than this adds a search field (default 8). */
  searchThreshold?: number
  className?: string
}

type TileModel = { kind: 'plugin'; plugin: PluginSummary } | { kind: 'more' } | { kind: 'asset' }

const TYPEAHEAD_RESET_MS = 600

/**
 * The "+" popover above the Composer (design-system: PluginMenu): a title, a "Manage" link and a
 * two-column grid of PluginTiles, grouped by scope when there is more than one. It is absolutely
 * positioned: place it inside the Composer's relatively positioned wrapper.
 */
export function PluginMenu(props: PluginMenuProps) {
  // Mounting the body per opening resets the search and focuses the first tile each time.
  return props.open ? <OpenMenu {...props} /> : null
}

function OpenMenu({
  plugins,
  onSelect,
  onClose,
  onManage,
  unavailableReason,
  returnFocusRef,
  addAsset,
  searchThreshold = 8,
  className
}: PluginMenuProps) {
  const root = useRef<HTMLDivElement>(null)
  const items = useRef<Array<HTMLElement | null>>([])
  const typed = useRef({ text: '', timer: undefined as ReturnType<typeof setTimeout> | undefined })
  const titleId = useId()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(0)

  const searching = search.trim() !== ''
  const groups = groupPlugins(plugins.filter((p) => matchesSearch(p, search)))
  const sections: Array<{ key: string; heading: string | null; tiles: TileModel[] }> = groups.map(
    (g) => ({
      key: g.scope,
      heading: g.heading,
      tiles: g.plugins.map((plugin) => ({ kind: 'plugin', plugin }))
    })
  )
  if (!searching) {
    const last = sections[sections.length - 1]
    if (last) last.tiles.push({ kind: 'more' })
    else sections.push({ key: 'more', heading: null, tiles: [{ kind: 'more' }] })
  }
  if (addAsset && !searching) {
    const first = sections[0]
    if (first && first.heading === null) first.heading = 'MAKE WITH CLAUDE'
    sections.unshift({ key: 'asset', heading: null, tiles: [{ kind: 'asset' }] })
  }
  const tiles = sections.flatMap((s) => s.tiles)
  const groupSizes = sections.map((s) => s.tiles.length)
  const manageIndex = tiles.length
  const nameOf = (tile: TileModel): string =>
    tile.kind === 'more'
      ? 'More plugins'
      : tile.kind === 'asset'
        ? ADD_ASSET_NAME
        : tile.plugin.name
  const reasonFor = (tile: TileModel): string | null =>
    tile.kind === 'plugin' ? (unavailableReason?.(tile.plugin) ?? null) : null
  const isDisabled = (tile: TileModel): boolean =>
    tile.kind === 'asset' ? !!addAsset?.disabled : reasonFor(tile) !== null

  const focusItem = (index: number, preventScroll = false): void => {
    setActive(index)
    items.current[index]?.focus({ preventScroll })
  }

  // On opening, focus the first tile that can run (06 §8.7).
  useEffect(() => {
    const first = tiles.findIndex((tile) => !isDisabled(tile))
    focusItem(Math.max(first, 0), true)
  }, [])

  // A press outside the menu (and its "+" button, which toggles it) closes it.
  useEffect(() => {
    const onPress = (event: PointerEvent): void => {
      const target = event.target as Node
      if (root.current?.contains(target) || returnFocusRef?.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPress)
    return () => document.removeEventListener('pointerdown', onPress)
  }, [onClose, returnFocusRef])

  useEffect(() => {
    const state = typed.current
    return () => clearTimeout(state.timer)
  }, [])

  const choose = (tile: TileModel): void => {
    if (tile.kind === 'more') onManage()
    else if (tile.kind === 'asset') addAsset?.onChoose()
    else onSelect(tile.plugin)
    onClose()
  }

  // Captured, because an open tooltip swallows Esc in the bubbling phase.
  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    onClose()
    returnFocusRef?.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = items.current.indexOf(event.target as HTMLElement)
    if (index < 0) {
      if (event.key === 'ArrowDown' && tiles.length > 0) {
        event.preventDefault()
        focusItem(0)
      }
      return
    }
    const to = menuFocusTarget(event.key, index, groupSizes)
    if (to !== null) {
      event.preventDefault()
      focusItem(to)
      return
    }
    if (
      event.key.length !== 1 ||
      event.key === ' ' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return
    }
    const state = typed.current
    clearTimeout(state.timer)
    state.text += event.key
    state.timer = setTimeout(() => (state.text = ''), TYPEAHEAD_RESET_MS)
    const labels = [...tiles.map(nameOf), 'Manage']
    const match = typeaheadMatch(labels, state.text, index)
    if (match >= 0) focusItem(match)
  }

  let flat = 0
  return (
    <div
      ref={root}
      role="menu"
      aria-labelledby={titleId}
      className={cx('plugin-menu', className)}
      onKeyDownCapture={onKeyDownCapture}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Tab (or any focus move) out of the menu closes it and lets focus move on.
        const next = event.relatedTarget as Node | null
        if (next && !event.currentTarget.contains(next)) onClose()
      }}
    >
      <div className="plugin-menu__header">
        <p id={titleId} className="plugin-menu__title">
          {addAsset ? 'What shall we add?' : 'What shall we make?'}
        </p>
        <TextLink
          role="menuitem"
          ref={(el) => {
            items.current[manageIndex] = el
          }}
          tabIndex={active === manageIndex ? 0 : -1}
          onFocus={() => setActive(manageIndex)}
          onClick={() => {
            onManage()
            onClose()
          }}
        >
          Manage
        </TextLink>
      </div>
      {plugins.length > searchThreshold && (
        <TextField
          variant="search"
          size="md"
          label="Find a plugin"
          placeholder="Find a plugin"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="plugin-menu__search"
        />
      )}
      <div className="plugin-menu__body">
        {searching && tiles.length === 0 && (
          <p className="plugin-menu__empty">No plugins match “{search.trim()}”.</p>
        )}
        {sections.map((section) => (
          <div
            key={section.key}
            role="group"
            aria-label={section.heading ?? undefined}
            className="plugin-menu__section"
          >
            {section.heading && <p className="plugin-menu__heading">{section.heading}</p>}
            <div className="plugin-menu__grid" data-single={section.key === 'asset' || undefined}>
              {section.tiles.map((tile) => {
                const index = flat++
                const reason = reasonFor(tile)
                const common = {
                  ref: (el: HTMLButtonElement | null) => {
                    items.current[index] = el
                  },
                  tabIndex: active === index ? 0 : -1,
                  onFocus: () => setActive(index),
                  onClick: () => choose(tile)
                }
                if (tile.kind === 'asset') {
                  return (
                    <AddAssetTile
                      key="asset"
                      showNew={addAsset?.showNew ?? false}
                      disabled={addAsset?.disabled}
                      {...common}
                    />
                  )
                }
                return tile.kind === 'more' ? (
                  <PluginTile key="more" name="More plugins" icon="plus" tone="more" {...common} />
                ) : (
                  <PluginTile
                    key={tile.plugin.id}
                    name={tile.plugin.name}
                    icon={tile.plugin.icon}
                    tone={tile.plugin.tint}
                    description={tile.plugin.description}
                    disabled={reason !== null}
                    disabledReason={reason ?? undefined}
                    {...common}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
