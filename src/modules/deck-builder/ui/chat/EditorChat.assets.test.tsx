import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import { ok } from '@shared/result'
import { asset, LIBRARY } from '../assets/testing'
import { HISTORY, chatItem, setupChat } from './testing'

const BOX = { name: 'Message your planning buddy' }
const STARTED = { 'chat:send': () => ok({ jobId: 'job_1', messageId: 'm2' }) }

const openMenu = async (t: ReturnType<typeof setupChat>) => {
  await t.user.click(screen.getByRole('button', { name: 'Plugins' }))
  return screen.findByRole('menu')
}
const openPicker = async (t: ReturnType<typeof setupChat>) => {
  const menu = await openMenu(t)
  await t.user.click(within(menu).getByRole('menuitem', { name: /Add asset/ }))
  return screen.findByRole('dialog', { name: 'Add an asset' })
}

describe('a deep link from the Assets page', () => {
  it('puts the text in the box with a chip, focuses it, and does so once per request', async () => {
    const t = setupChat({ props: { composerRequest: { text: '{{school_logo}} ', key: 1 } } })
    const box = screen.getByRole('textbox', BOX) as HTMLTextAreaElement
    expect(box.value).toBe('{{school_logo}} ')
    expect(box).toHaveFocus()
    expect(await screen.findByRole('group', { name: 'school_logo' })).toBeInTheDocument()
    await t.user.type(box, 'here')
    t.rerender({ composerRequest: { text: '{{school_logo}} ', key: 1 } })
    expect(box.value).toBe('{{school_logo}} here')
    t.rerender({ composerRequest: { text: '{{school_logo}} ', key: 2 } })
    expect(box.value).toBe('{{school_logo}} here {{school_logo}} ')
  })
})

describe('A3: the + menu with Add asset', () => {
  it('shows the Add asset tile first, with its line and the New pill', async () => {
    const t = setupChat()
    const menu = await openMenu(t)
    expect(within(menu).getByText('What shall we add?')).toBeInTheDocument()
    const first = within(menu).getByRole('menuitem', { name: /Add asset/ })
    const more = within(menu).getByRole('menuitem', { name: /More plugins/ })
    expect(first.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(first).toHaveAttribute('aria-description', 'A logo, icon or picture from your library')
    expect(within(first).getByText('New')).toBeInTheDocument()
    expect(within(menu).getByText('MAKE WITH CLAUDE')).toBeInTheDocument()
  })

  it('drops the New pill once it has been used three times', async () => {
    const t = setupChat({ menuUses: 3 })
    const menu = await openMenu(t)
    await waitFor(() => expect(within(menu).queryByText('New')).not.toBeInTheDocument())
  })

  it('counts every use in the settings preferences', async () => {
    const t = setupChat({ menuUses: 1 })
    await openPicker(t)
    expect(t.settings.setPreferences).toHaveBeenCalledWith({ assetsMenuUses: 2 })
  })

  it('works without any slides: the tile is a built-in, not a plugin', async () => {
    const t = setupChat({ props: { deck: { ...fixtureDeck(), slides: [] } } })
    expect(await openPicker(t)).toBeInTheDocument()
  })
})

describe('A4: the asset picker over the chat', () => {
  it('lists recently used and all assets, and opens with the first tile focused', async () => {
    const t = setupChat()
    const card = await openPicker(t)
    expect(await within(card).findByText('RECENTLY USED')).toBeInTheDocument()
    expect(within(card).getByText(`ALL ASSETS · ${LIBRARY.length}`)).toBeInTheDocument()
    expect(within(card).getByText('Tip:', { exact: false })).toBeInTheDocument()
    await waitFor(() =>
      expect(within(card).getAllByRole('button', { name: 'school_logo' })[0]).toHaveFocus()
    )
  })

  it('inserts {{name}} at the caret, shows a chip and puts focus back in the box', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), 'Put  in the corner')
    const box = screen.getByRole('textbox', BOX) as HTMLTextAreaElement
    box.setSelectionRange(4, 4)
    const card = await openPicker(t)
    await t.user.click((await within(card).findAllByRole('button', { name: 'school_logo' }))[0]!)
    expect(screen.queryByRole('dialog', { name: 'Add an asset' })).not.toBeInTheDocument()
    expect(box.value).toBe('Put {{school_logo}} in the corner')
    expect(await screen.findByRole('group', { name: 'school_logo' })).toBeInTheDocument()
    expect(box).toHaveFocus()
  })

  it('Esc closes it without changing the text and returns focus to +', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), 'Hello')
    const card = await openPicker(t)
    await within(card).findByText('RECENTLY USED')
    await t.user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Add an asset' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Hello')
    expect(screen.getByRole('button', { name: 'Plugins' })).toHaveFocus()
  })

  it('says so when the library is empty', async () => {
    const t = setupChat({ library: [] })
    const card = await openPicker(t)
    expect(await within(card).findByText("You don't have any assets yet.")).toBeInTheDocument()
    await t.user.click(within(card).getByRole('button', { name: 'Open library' }))
    expect(t.shell.navigate).toHaveBeenCalledWith('assets', { kind: 'library' })
  })

  it('"Find online" opens the online search of the Assets page', async () => {
    const t = setupChat({ library: [] })
    const card = await openPicker(t)
    await t.user.click(await within(card).findByRole('button', { name: 'Find online' }))
    expect(t.shell.navigate).toHaveBeenCalledWith('assets', { kind: 'online' })
  })
})

describe('A4: typing {{ in the chat', () => {
  it('opens the same picker filtered by the typed letters, and Enter completes the token', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), 'Put {{{{sch')
    const card = await screen.findByRole('dialog', { name: 'Add an asset' })
    expect(within(card).queryByRole('searchbox')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(within(card).getAllByRole('button', { name: 'school_logo' }).length).toBeGreaterThan(0)
      expect(within(card).queryByRole('button', { name: 'owl_mascot' })).not.toBeInTheDocument()
    })
    await t.user.keyboard('{Enter}')
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Put {{school_logo}} ')
    expect(screen.queryByRole('dialog', { name: 'Add an asset' })).not.toBeInTheDocument()
    expect(t.db['chat:send']).not.toHaveBeenCalled()
    expect(await screen.findByRole('group', { name: 'school_logo' })).toBeInTheDocument()
  })

  it('Esc leaves the text as typed', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), 'Put {{{{sch')
    await screen.findByRole('dialog', { name: 'Add an asset' })
    await t.user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Add an asset' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Put {{sch')
  })

  it('goes away when the braces are left behind', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), '{{{{sch')
    await screen.findByRole('dialog', { name: 'Add an asset' })
    await t.user.type(screen.getByRole('textbox', BOX), '}} ')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add an asset' })).not.toBeInTheDocument()
    )
  })

  it('a click on a tile completes the open token too', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), 'Add {{{{owl')
    const card = await screen.findByRole('dialog', { name: 'Add an asset' })
    await t.user.click((await within(card).findAllByRole('button', { name: 'owl_mascot' }))[0]!)
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Add {{owl_mascot}} ')
  })
})

describe('A5: chips in the composer and in messages', () => {
  it('a typed complete token becomes a chip, and its × takes the token out', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), 'Now add {{{{owl_mascot}} here')
    const chip = await screen.findByRole('group', { name: 'owl_mascot' })
    await t.user.click(
      within(chip.parentElement as HTMLElement).getByRole('button', { name: 'Remove owl_mascot' })
    )
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Now add here')
    expect(screen.queryByRole('group', { name: 'owl_mascot' })).not.toBeInTheDocument()
  })

  it('sends the chat with one ref per distinct chip', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    await t.user.type(
      screen.getByRole('textbox', BOX),
      'Put {{{{school_logo}} top right and {{{{school_logo}} again'
    )
    await screen.findByRole('group', { name: 'school_logo' })
    await t.user.keyboard('{Enter}')
    expect(t.db['chat:send']).toHaveBeenCalledTimes(1)
    const sent = t.db['chat:send'].mock.calls[0][0]
    expect(sent.assetRefs).toEqual([{ assetId: 'ast_school_logo', name: 'school_logo' }])
    expect(sent.text).toBe('Put {{school_logo}} top right and {{school_logo}} again')
    // her own message is drawn with the chip
    expect((await screen.findAllByRole('group', { name: 'school_logo' })).length).toBeGreaterThan(1)
  })

  it('blocks Send for a name that is not an asset and says which', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    await t.user.type(screen.getByRole('textbox', BOX), 'Add {{{{unicorn}} please')
    expect(await screen.findByText('No asset called unicorn.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await t.user.keyboard('{Enter}')
    expect(t.db['chat:send']).not.toHaveBeenCalled()
  })

  it('draws chips in stored messages with the current name, and "removed" for a deleted asset', async () => {
    const renamed = asset('crest', { id: 'ast_school_logo', kind: 'logo' })
    setupChat({
      library: [renamed],
      props: {
        initialChat: [
          chatItem({
            id: 'u1',
            role: 'user',
            text: 'Put {{school_logo}} in the top right',
            assets: [{ assetId: 'ast_school_logo', name: 'school_logo' }]
          }),
          chatItem({
            id: 'a1',
            role: 'assistant',
            text: 'Done! {{old_owl}} is gone but {{school_logo}} stays.',
            assets: [
              { assetId: 'ast_old_owl', name: 'old_owl' },
              { assetId: 'ast_school_logo', name: 'school_logo' }
            ]
          })
        ]
      }
    })
    expect((await screen.findAllByRole('group', { name: 'crest' })).length).toBe(2)
    expect(await screen.findByRole('group', { name: 'old_owl, removed' })).toBeInTheDocument()
    expect(screen.queryByText('{{school_logo}}', { exact: false })).not.toBeInTheDocument()
  })

  it('leaves an unknown token in Claude’s text as typed', async () => {
    setupChat({
      props: {
        initialChat: [chatItem({ id: 'a1', role: 'assistant', text: 'I used {{ghost}} here.' })]
      }
    })
    expect(await screen.findByText('I used {{ghost}} here.')).toBeInTheDocument()
  })
})

describe('A5: natural placement in the chat', () => {
  const placed = chatItem({
    id: 'a1',
    role: 'assistant',
    text: 'Done! {{school_logo}} is in the top-right corner of slide 3.',
    assets: [{ assetId: 'ast_school_logo', name: 'school_logo' }],
    result: { changeSetId: 'cs1', label: 'Slide 3 changed', slideIds: ['s3'], undone: false }
  })
  const latest = { ...HISTORY, canUndo: true, undoChangeSetId: 'cs1' }

  it('shows the chip in Claude’s answer with the "Slide 3 changed" chip and Undo', async () => {
    const undo = vi.fn(() =>
      ok({ deck: fixtureDeck(), history: { ...HISTORY, canRedo: true, redoChangeSetId: 'cs1' } })
    )
    const t = setupChat({
      deckBuilder: { undo },
      props: { initialChat: [placed], history: latest }
    })
    expect(await screen.findByRole('group', { name: 'school_logo' })).toBeInTheDocument()
    expect(screen.getByText('Slide 3 changed')).toBeInTheDocument()
    await t.user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalledWith({ lessonId: 'les_1' })
    expect(await screen.findByText('Undone')).toBeInTheDocument()
  })

  it('reads the chat again when the editor places an asset (the history changed), so its message appears', async () => {
    const t = setupChat({ props: { history: HISTORY } })
    expect(screen.queryByText('Slide 3 changed')).not.toBeInTheDocument()
    t.view.chat = [placed]
    t.rerender({ history: latest })
    expect(await screen.findByText('Slide 3 changed')).toBeInTheDocument()
    expect(await screen.findByRole('group', { name: 'school_logo' })).toBeInTheDocument()
  })
})

describe('A12: the picture spots card in the chat', () => {
  it('shows the live count under the message that left spots and opens the first one', async () => {
    const onFillFirst = vi.fn()
    const t = setupChat({
      props: {
        spots: { count: 3, onFillFirst },
        initialChat: [
          chatItem({
            id: 'a1',
            role: 'assistant',
            text: 'Done! 8 slides in your Science style.',
            showSpots: true,
            result: { changeSetId: 'cs1', label: '8 slides added', slideIds: ['s1'], undone: false }
          })
        ]
      }
    })
    expect(await screen.findByText('3 picture spots to fill')).toBeInTheDocument()
    await t.user.click(screen.getByRole('button', { name: 'Fill the first one' }))
    expect(onFillFirst).toHaveBeenCalledTimes(1)
  })

  it('turns mint when every spot is filled', () => {
    setupChat({
      props: {
        spots: { count: 0, onFillFirst: vi.fn() },
        initialChat: [chatItem({ id: 'a1', role: 'assistant', text: 'Done!', showSpots: true })]
      }
    })
    expect(screen.getByText('All picture spots are filled.')).toBeInTheDocument()
  })

  it('does not draw the card under other messages', () => {
    setupChat({
      props: {
        spots: { count: 2, onFillFirst: vi.fn() },
        initialChat: [chatItem({ id: 'a1', role: 'assistant', text: 'Hello' })]
      }
    })
    expect(screen.queryByText('2 picture spots to fill')).not.toBeInTheDocument()
  })
})

describe('sheets from the editor', () => {
  it('replaces the panel while a sheet is open and keeps the draft', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), 'keep me')
    t.rerender({ sheet: <section role="dialog" aria-label="Test sheet" /> })
    expect(screen.getByRole('dialog', { name: 'Test sheet' })).toBeInTheDocument()
    t.rerender({ sheet: undefined })
    expect(screen.getByRole('textbox', BOX)).toHaveValue('keep me')
  })
})
