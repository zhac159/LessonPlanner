import { describe, expect, it } from 'vitest'
import { isFontInstalled, parseFontRegistry, readInstalledFonts } from './installedFonts'

const SAMPLE = [
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
  '    Calibri (TrueType)    REG_SZ    calibri.ttf',
  '    Calibri Bold (TrueType)    REG_SZ    calibrib.ttf',
  '    Cambria & Cambria Math (TrueType)    REG_SZ    cambria.ttc',
  '    Segoe UI Semibold (TrueType)    REG_SZ    seguisb.ttf',
  '    Lexend (OpenType)    REG_SZ    C:\\Users\\t\\Lexend.otf',
  ''
].join('\r\n')

describe('parseFontRegistry', () => {
  it('extracts lower-case names without the format suffix and splits combined entries', () => {
    expect(parseFontRegistry(SAMPLE)).toEqual(
      new Set(['calibri', 'calibri bold', 'cambria', 'cambria math', 'segoe ui semibold', 'lexend'])
    )
  })

  it('ignores headers, blank lines and garbage', () => {
    expect(parseFontRegistry('nothing useful\n\n')).toEqual(new Set())
  })
})

describe('isFontInstalled', () => {
  const installed = parseFontRegistry(SAMPLE)

  it('matches exact names case-insensitively', () => {
    expect(isFontInstalled(installed, 'Calibri')).toBe(true)
    expect(isFontInstalled(installed, ' LEXEND ')).toBe(true)
  })

  it('matches a family through one of its styles', () => {
    expect(isFontInstalled(installed, 'Segoe UI')).toBe(true)
  })

  it('does not match a different family that merely starts the same way', () => {
    expect(isFontInstalled(installed, 'Cal')).toBe(false)
    expect(isFontInstalled(installed, 'Poppins')).toBe(false)
  })
})

describe('readInstalledFonts', () => {
  it('merges the machine and user keys', async () => {
    const fonts = await readInstalledFonts('win32', async (key) =>
      key.startsWith('HKLM') ? SAMPLE : '    Poppins (TrueType)    REG_SZ    p.ttf'
    )
    expect(fonts?.has('calibri')).toBe(true)
    expect(fonts?.has('poppins')).toBe(true)
  })

  it('survives a missing per-user key', async () => {
    const fonts = await readInstalledFonts('win32', async (key) => {
      if (key.startsWith('HKCU')) throw new Error('not found')
      return SAMPLE
    })
    expect(fonts?.has('calibri')).toBe(true)
  })

  it('returns undefined (unknown) off Windows or when nothing can be read', async () => {
    expect(await readInstalledFonts('linux', async () => SAMPLE)).toBeUndefined()
    expect(
      await readInstalledFonts('win32', async () => Promise.reject(new Error('denied')))
    ).toBeUndefined()
    expect(await readInstalledFonts('win32', async () => 'empty')).toBeUndefined()
  })
})
