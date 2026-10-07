import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { suggestAssetName } from '@shared/assets/names'
import type { MakeVersions } from '@shared/assets/pictureMaker'
import type { AssetSourceRef } from '@shared/assets/place'
import type { SpotRef } from '@shared/assets/spots'
import { ASSETS, type AssetsApi, type AssetSummary } from '@shared/contracts/assets'
import type { PickerTab } from '@ui/assets'
import { assumedSize } from '../logic/preview'
import { useAssetLibrary } from './useAssetLibrary'
import { useMakeVersions } from './useMakeVersions'
import { useOnlineSearch } from './useOnlineSearch'
import { useSuggestions } from './useSuggestions'

/** What she chose in A13: an asset of hers, a search result or a version just made. */
export type SpotPick =
  | { tab: 'assets'; assetId: string }
  | { tab: 'online'; resultId: string }
  | { tab: 'make'; version: number }

/** The picture the preview draws for a pick, and how big it is (results and versions may not say). */
export interface PickedPicture {
  src: string | null
  size: { width: number; height: number }
  name: string
}

const MAX_BASED_ON = 3

/**
 * The three sources of A13 for ONE spot: her library (with suggestions for the spot), a free-image search that runs
 * once with the spot's words, and a picture-maker job. Nothing is placed here; `source` says what would be.
 */
export function useSpotSources(lessonId: string, spot: SpotRef | null, tab: PickerTab) {
  const client = useClient<AssetsApi>(ASSETS)
  const [search, setSearch] = useState('')
  const library = useAssetLibrary(search, spot !== null)
  const [freeToUse, setFreeToUse] = useState(true)
  const online = useOnlineSearch(freeToUse)
  const make = useMakeVersions(spot !== null && tab === 'make')
  const [pick, setPick] = useState<SpotPick | null>(null)
  const [onlineQuery, setOnlineQuery] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const [nameError, setNameError] = useState<string | undefined>()
  const [makePrompt, setMakePrompt] = useState('')
  const [makeVersions, setMakeVersions] = useState<MakeVersions>(4)
  const [removedBasis, setRemovedBasis] = useState<string[]>([])
  const searched = useRef<string | null>(null)
  const resetMake = make.reset

  const spotKey = spot ? `${spot.slideId}:${spot.elementId}` : null
  // A different spot: start clean (the library list and the search cache stay).
  useEffect(() => {
    setPick(null)
    setSearch('')
    setOnlineQuery(spot?.query ?? '')
    setMakePrompt(spot?.description ?? '')
    setRemovedBasis([])
    setNames({})
    setNameError(undefined)
    searched.current = null
    resetMake()
  }, [spotKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // First visit to "Find online" for this spot: the search runs by itself, with the spot's words.
  const runSearch = online.search
  useEffect(() => {
    if (!spot || tab !== 'online' || searched.current === spotKey) return
    searched.current = spotKey
    void runSearch(spot.query)
  }, [spot, spotKey, tab, runSearch])
  // The "Free to use" chip was toggled after a search: ask again with the new setting.
  const toggled = useRef(runSearch)
  useEffect(() => {
    if (toggled.current === runSearch) return
    toggled.current = runSearch
    if (searched.current !== null) void runSearch(onlineQuery)
  }, [runSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggested = useSuggestions(
    { lessonId, slideId: spot?.slideId ?? null, words: spot?.description },
    spot !== null
  )
  const suggestions = useMemo(() => {
    const own = (spot?.suggestedAssets ?? [])
      .map((id) => library.assets.find((a) => a.id === id))
      .filter((a): a is AssetSummary => a !== undefined)
    const seen = new Set<string>()
    return [...own, ...suggested].filter((a) => !seen.has(a.id) && seen.add(a.id)).slice(0, 3)
  }, [spot, library.assets, suggested])

  // The first result (or suggestion) is chosen at once, so the spot shows a preview straight away.
  const firstResult = online.state.results[0]?.id
  const firstSuggestion = suggestions[0]?.id
  useEffect(() => {
    if (!spot) return
    const stale =
      pick?.tab === 'online' && !online.state.results.some((r) => r.id === pick.resultId)
    if (pick?.tab === tab && !stale) return
    if (tab === 'online' && firstResult) setPick({ tab: 'online', resultId: firstResult })
    else if (tab === 'assets' && firstSuggestion)
      setPick({ tab: 'assets', assetId: firstSuggestion })
  }, [spot, tab, pick, online.state.results, firstResult, firstSuggestion])

  const basedOn = useMemo(() => {
    const kind = spot?.kind
    const pool = library.assets.filter((a) => !removedBasis.includes(a.id))
    const same = kind ? pool.filter((a) => a.kind === kind) : []
    return (same.length > 0 ? same : pool).slice(0, MAX_BASED_ON)
  }, [spot, library.assets, removedBasis])

  const onlineResult =
    pick?.tab === 'online'
      ? (online.state.results.find((r) => r.id === pick.resultId) ?? null)
      : null
  const version =
    pick?.tab === 'make'
      ? (make.progress?.versions.find((v) => v.index === pick.version) ?? null)
      : null
  const asset =
    pick?.tab === 'assets'
      ? ([...suggestions, ...library.assets].find((a) => a.id === pick.assetId) ?? null)
      : null

  const nameKey =
    pick?.tab === 'online' ? `online:${pick.resultId}` : tab === 'make' ? 'make' : null
  const proposed =
    pick?.tab === 'online'
      ? (onlineResult?.proposedName ?? '')
      : suggestAssetName(
          spot?.description ?? 'picture',
          library.assets.map((a) => a.name)
        )
  const savedName = nameKey ? (names[nameKey] ?? proposed) : ''

  const setSavedName = useCallback(
    (name: string): void => {
      if (!nameKey) return
      setNames((was) => ({ ...was, [nameKey]: name }))
      Promise.resolve(client.checkName({ name }))
        .then((check) => setNameError(check.ok ? undefined : check.message))
        .catch(() => setNameError(undefined))
    },
    [client, nameKey]
  )

  const picture: PickedPicture | null = asset
    ? {
        src: asset.thumbDataUrl,
        size: { width: asset.width, height: asset.height },
        name: asset.name
      }
    : onlineResult
      ? {
          src: onlineResult.thumbDataUrl,
          size:
            onlineResult.width && onlineResult.height
              ? { width: onlineResult.width, height: onlineResult.height }
              : assumedSize(spot?.kind),
          name: savedName
        }
      : version?.thumbDataUrl
        ? { src: version.thumbDataUrl, size: assumedSize(spot?.kind), name: savedName }
        : null

  const source = useCallback((): AssetSourceRef | null => {
    if (!pick) return null
    if (pick.tab === 'assets') return { kind: 'library', assetId: pick.assetId }
    if (pick.tab === 'online') return { kind: 'online', resultId: pick.resultId, name: savedName }
    return make.jobId
      ? { kind: 'made', jobId: make.jobId, version: pick.version, name: savedName }
      : null
  }, [pick, savedName, make.jobId])

  const startMake = useCallback((): void => {
    setPick(null)
    void make.start({
      prompt: makePrompt,
      versions: makeVersions,
      basedOn: basedOn.map((a) => a.id),
      kind: spot?.kind ?? undefined
    })
  }, [make, makePrompt, makeVersions, basedOn, spot])

  return {
    library,
    search,
    setSearch,
    suggestions,
    pick,
    setPick,
    online: online.state,
    onlineQuery,
    setOnlineQuery,
    freeToUse,
    setFreeToUse,
    runOnline: () => void runSearch(onlineQuery),
    savedName,
    setSavedName,
    nameError,
    make,
    makePrompt,
    setMakePrompt,
    makeVersions,
    setMakeVersions,
    startMake,
    basedOn,
    removeBasis: (id: string) => setRemovedBasis((was) => [...was, id]),
    picture,
    source
  }
}
