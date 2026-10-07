import { screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { SettingsApi } from '@shared/contracts/settings'
import { ok } from '@shared/result'
import { useShell } from '@renderer/core/ShellContext'
import { useClient, useEvent } from '@renderer/core/hooks'
import { createFakeApi, installFakeWindowApi } from './fakeApi'
import { createFakeClients, fakeClient } from './fakeClients'
import { fakeShell, renderWithApp } from './render'

describe('fakeClient', () => {
  it('wraps implemented methods as spies returning promises', async () => {
    const client = fakeClient<SettingsApi>({
      getProfile: () => ok({ profile: {} as never })
    })
    await expect(client.getProfile()).resolves.toMatchObject({ ok: true })
    expect(client.getProfile).toHaveBeenCalledTimes(1)
  })

  it('rejects clearly for methods the test did not implement', async () => {
    const client = fakeClient<SettingsApi>()
    await expect(client.getAiStatus()).rejects.toThrow(/"getAiStatus".*did not implement/)
  })

  it('turns synchronous throws into rejections and is not thenable', async () => {
    const client = fakeClient<SettingsApi>({
      setModel: () => {
        throw new Error('nope')
      }
    })
    await expect(client.setModel('opus-5.5')).rejects.toThrow('nope')
    expect((client as unknown as { then?: unknown }).then).toBeUndefined()
  })
})

describe('createFakeClients', () => {
  it('serves listed clients, defaults others to rejecting, and keeps identity stable', async () => {
    const settings = fakeClient<SettingsApi>()
    const clients = createFakeClients({ settings })
    expect(clients.client('settings')).toBe(settings)
    expect(clients.client('other')).toBe(clients.client('other'))
    await expect(
      (clients.client<{ x(): void }>('other').x as () => Promise<void>)()
    ).rejects.toThrow('did not implement')
  })

  it('emit reaches subscribers until they unsubscribe', () => {
    const clients = createFakeClients()
    const listener = vi.fn()
    const off = clients.subscribe('m', 'evt', listener)
    clients.emit('m', 'evt', 1)
    off()
    clients.emit('m', 'evt', 2)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(1)
  })
})

describe('fake window.api', () => {
  it('has spies for every window function and fake file paths', () => {
    const api = createFakeApi()
    api.window.setFullScreen(true)
    expect(api.window.setFullScreen).toHaveBeenCalledWith(true)
    expect(api.files.pathFor(new File([''], 'a.pptx'))).toContain('a.pptx')
    expect(api.testMode).toBe(false)
  })

  it('applies overrides per member and restores the previous api', async () => {
    const before = (window as { api?: unknown }).api
    const fake = installFakeWindowApi({
      platform: 'darwin',
      window: { isMaximized: async () => true }
    })
    expect(window.api.platform).toBe('darwin')
    await expect(window.api.window.isMaximized()).resolves.toBe(true)
    expect(window.api.window.close).toBeDefined()
    fake.restore()
    expect((window as { api?: unknown }).api).toBe(before)
  })

  it('rejects module invokes that are not faked', async () => {
    await expect(createFakeApi().modules.invoke('home', 'ping')).rejects.toThrow('not faked')
  })
})

describe('renderWithApp', () => {
  function Probe() {
    const shell = useShell()
    const settings = useClient<SettingsApi>('settings')
    const [last, setLast] = useState('none')
    useEvent<{ ping: string }>('home', 'ping', (value) => setLast(value))
    return (
      <div>
        <p>active:{shell.activeId}</p>
        <p>event:{last}</p>
        <button onClick={() => shell.navigate('styles', { kind: 'x' })}>nav</button>
        <button onClick={() => void settings.getAiStatus()}>status</button>
      </div>
    )
  }

  it('provides a fake shell whose callbacks are spies', async () => {
    const { user, shell } = renderWithApp(<Probe />, { shell: { activeId: 'home' } })
    expect(screen.getByText('active:home')).toBeInTheDocument()
    await user.click(screen.getByText('nav'))
    expect(shell.navigate).toHaveBeenCalledWith('styles', { kind: 'x' })
  })

  it('provides clients and events, and keeps providers on rerender', async () => {
    const getAiStatus = vi.fn(() => ({}) as never)
    const clients = createFakeClients({ settings: fakeClient<SettingsApi>({ getAiStatus }) })
    const { user, rerender } = renderWithApp(<Probe />, { clients })
    await user.click(screen.getByText('status'))
    expect(getAiStatus).toHaveBeenCalled()
    rerender(<Probe />)
    clients.emit('home', 'ping', 'pong')
    expect(await screen.findByText('event:pong')).toBeInTheDocument()
  })

  it('installs a fake window.api only when none exists or overrides are given', () => {
    const own = installFakeWindowApi({ platform: 'linux' })
    renderWithApp(<p>x</p>)
    expect(window.api.platform).toBe('linux')
    renderWithApp(<p>y</p>, { api: { platform: 'darwin' } })
    expect(window.api.platform).toBe('darwin')
    own.restore()
  })

  it('fakeShell has complete defaults', () => {
    expect(fakeShell()).toMatchObject({ chrome: 'sidebar', user: null, intent: null, activeId: '' })
    expect(fakeShell({ chrome: 'none' }).chrome).toBe('none')
  })
})
