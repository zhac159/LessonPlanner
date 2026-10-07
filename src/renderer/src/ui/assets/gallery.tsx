import { Fragment, type ReactNode } from 'react'
import { LICENCES } from '@shared/assets/credits'
import type { LeftOutReason } from '@shared/contracts/assets'
import type { GalleryGroup } from '../gallery'
import { AssetDetailPanel } from './AssetDetail/AssetDetailPanel'
import { AssetFacts } from './AssetDetail/AssetFacts'
import { ChatNameField } from './AssetDetail/ChatNameField'
import { CreditLine, SourceLine } from './AssetDetail/SourceInfo'
import { TagEditor } from './AssetDetail/TagEditor'
import { BasedOnStrip } from './MakeNew/BasedOnStrip'
import { OnlineDetail } from './OnlineSearch/OnlineDetail'
import { OnlineResultCard } from './OnlineResultCard/OnlineResultCard'
import { ReviewFileRow, ReviewMoreRow } from './Review/ReviewFileRow'
import { ReviewFilter } from './Review/ReviewFilter'
import { ReviewRow } from './Review/ReviewRow'
import { VersionPicker } from './MakeNew/VersionPicker'
import { KeepDemo, MakeDemo, OnlineDemo } from './galleryDemos'
import { SAMPLE_ASSETS, SAMPLE_DETAIL, SAMPLE_RESULTS, volcano } from './galleryData'
import { librarySections } from './gallerySections'
import { foundSummary, keepLabel } from './internal/format'

const noop = (): void => {}
const grid = (children: ReactNode, min = 220) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
      gap: 16,
      alignItems: 'start'
    }}
  >
    {children}
  </div>
)

const REASONS: Array<[LeftOutReason, string | undefined]> = [
  ['pupils', undefined],
  ['blurry', undefined],
  ['older-version', 'school_logo'],
  ['low-resolution', undefined],
  ['background', undefined],
  ['unreadable', undefined],
  ['duplicate', undefined]
]
const online = {
  ...SAMPLE_DETAIL,
  sourceKind: 'online' as const,
  foundIn: [],
  source: { kind: 'online' as const, provider: 'wikimedia' as const, at: '2026-03-01T00:00:00Z' },
  licence: { ...LICENCES['cc-by-sa'], label: 'CC BY-SA 4.0' },
  credit: {
    text: '“Volcano cross-section” by Ann Lee, CC BY-SA 4.0, via Wikimedia Commons',
    inNotes: true,
    provider: 'wikimedia' as const,
    author: 'Ann Lee',
    title: 'Volcano cross-section',
    pageUrl: 'https://commons.wikimedia.org/',
    licenceUrl: null
  }
}
const detailProps = {
  onRename: noop,
  onTitleCommit: noop,
  onDescriptionCommit: noop,
  onTagsChange: noop,
  onUseInLesson: noop,
  onReplaceFile: noop,
  onDelete: noop,
  onOpenUsage: noop,
  onOpenSource: noop
}
const review = (
  asset: (typeof SAMPLE_ASSETS)[number],
  over: Partial<Parameters<typeof ReviewRow>[0]> = {}
) => (
  <ReviewRow
    name={asset.name}
    kind={asset.kind}
    thumbSrc={asset.thumbDataUrl}
    decks={24}
    keep
    onKeepChange={noop}
    onNameCommit={noop}
    onKindChange={noop}
    {...over}
  />
)

const flowSections = [
  {
    name: 'OnlineResultCard · A9 grid with checkboxes, A13 compact',
    render: () => (
      <div style={{ display: 'grid', gap: 24 }}>
        <OnlineDemo />
        <div style={{ width: 380 }}>
          {grid(
            SAMPLE_RESULTS.slice(0, 3).map((r) => (
              <OnlineResultCard key={r.id} compact {...r} selected={r.id === 'r1'} />
            )),
            100
          )}
        </div>
      </div>
    )
  },
  {
    name: 'OnlineDetail · needs a credit, no credit, check the licence',
    render: () =>
      grid(
        (['cc-by-sa', 'cc0', 'cc-by-nc'] as const).map((id) => (
          <OnlineDetail
            key={id}
            title="Volcano cross-section"
            providerLabel="Wikimedia Commons"
            licence={{
              ...LICENCES[id],
              label: id === 'cc-by-sa' ? 'CC BY-SA 4.0' : LICENCES[id].label
            }}
            width={1600}
            height={1200}
            previewSrc={volcano}
            name="volcano_cross_section"
            onNameChange={noop}
            onAdd={noop}
            onOpenSource={noop}
          />
        )),
        360
      )
  },
  {
    name: 'AssetDetailPanel · found in a deck, picked online, name problem',
    render: () =>
      grid(
        <>
          <AssetDetailPanel asset={SAMPLE_DETAIL} {...detailProps} />
          <AssetDetailPanel asset={online} {...detailProps} />
          <AssetDetailPanel
            asset={SAMPLE_DETAIL}
            {...detailProps}
            nameError="You already have an asset called owl_mascot."
            useDisabledReason="Make a lesson first"
          />
        </>,
        360
      )
  },
  {
    name: 'AssetDetail parts · ChatNameField, TagEditor, AssetFacts, SourceLine, CreditLine',
    render: () => (
      <div style={{ display: 'grid', gap: 16, width: 340 }}>
        <ChatNameField value="school_logo" onCommit={noop} />
        <TagEditor tags={['logo', 'title slides']} onChange={noop} />
        <AssetFacts asset={SAMPLE_DETAIL} onOpenUsage={noop} />
        <SourceLine provider="openverse" licence={LICENCES['cc-by']} onOpenSource={noop} />
        <CreditLine credit={online.credit} />
      </div>
    )
  },
  {
    name: 'ReviewRow · kept, left out (every reason), name problem',
    render: () => (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <strong>{foundSummary(12, 9)}</strong>
          <ReviewFilter value="all" onChange={noop} />
          <span>{keepLabel(9)}</span>
        </div>
        {grid(
          <>
            {SAMPLE_ASSETS.slice(0, 3).map((a) => (
              <Fragment key={a.id}>{review(a)}</Fragment>
            ))}
            {review(SAMPLE_ASSETS[3]!, {
              nameError: 'Use letters, numbers and underscores, with at least one letter.'
            })}
            {REASONS.map(([reason, ofName]) => (
              <Fragment key={reason}>
                {review(SAMPLE_ASSETS[11]!, { keep: false, leftOut: { reason, ofName } })}
              </Fragment>
            ))}
          </>
        )}
      </div>
    )
  },
  {
    name: 'ReviewFileRow · done, working, failed, waiting, collapsed',
    render: () => (
      <ul style={{ display: 'grid', gap: 8, width: 360, margin: 0, padding: 0 }}>
        <ReviewFileRow fileName="Y8 Photosynthesis.pptx" state="done" found={4} />
        <ReviewFileRow fileName="Y7 Cells and organelles.pdf" state="done" found={3} />
        <ReviewMoreRow count={5} found={3} onToggle={noop} />
        <ReviewFileRow
          fileName="Y7 icon sheet.pdf"
          state="working"
          progress={{ done: 4, total: 6, label: 'Cutting out pictures · page 4 of 6' }}
        />
        <ReviewFileRow
          fileName="Scan.pdf"
          state="failed"
          error="This PDF is only scanned pages, so there's nothing to cut out."
          onRetry={noop}
        />
        <ReviewFileRow fileName="Y9 Forces recap.pptx" state="waiting" />
      </ul>
    )
  },
  { name: 'MakeNewPanel · based on, request, versions, keep', render: () => <MakeDemo /> },
  {
    name: 'VersionPicker · waiting, failed, ready',
    render: () => (
      <div style={{ width: 340 }}>
        <VersionPicker
          versions={[
            { index: 1, state: 'ready', thumbSrc: volcano },
            { index: 2, state: 'waiting' },
            { index: 3, state: 'failed' },
            { index: 4, state: 'waiting' }
          ]}
          selected={1}
          onSelect={noop}
          onRetryVersion={noop}
          stageLabel="Drawing…"
        />
      </div>
    )
  },
  {
    name: 'KeepForm · name, Use version 3, Try again',
    render: () => <KeepDemo />
  },
  {
    name: 'BasedOnStrip · picked assets with ×, none picked',
    render: () => (
      <div style={{ display: 'grid', gap: 16, width: 340 }}>
        <BasedOnStrip
          items={SAMPLE_ASSETS.slice(3, 6).map((a) => ({
            id: a.id,
            name: a.name,
            thumbSrc: a.thumbDataUrl
          }))}
          onRemove={noop}
        />
        <BasedOnStrip items={[]} />
      </div>
    )
  }
]

/** The assets kit specimens (alias `@ui/assets`); more states are in the component tests. */
const gallery: GalleryGroup = {
  title: 'Assets',
  sections: [...librarySections, ...flowSections]
}

export default gallery
