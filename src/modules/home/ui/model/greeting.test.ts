import { describe, expect, it } from 'vitest'
import { greetingFor, partOfDay } from './greeting'

const at = (hour: number, minute = 0): Date => new Date(2026, 9, 6, hour, minute)

describe('partOfDay', () => {
  it.each([
    [5, 0, 'morning'],
    [11, 59, 'morning'],
    [12, 0, 'afternoon'],
    [17, 59, 'afternoon'],
    [18, 0, 'evening'],
    [23, 30, 'evening'],
    [0, 0, 'evening'],
    [4, 59, 'evening']
  ] as const)('%i:%i is %s', (hour, minute, expected) => {
    expect(partOfDay(at(hour, minute))).toBe(expected)
  })
})

describe('greetingFor', () => {
  it('uses the name', () => {
    expect(greetingFor(at(9), 'Alice')).toBe('Good morning, Alice!')
    expect(greetingFor(at(13), 'Alice')).toBe('Good afternoon, Alice!')
    expect(greetingFor(at(19), 'Alice')).toBe('Good evening, Alice!')
  })

  it('drops the comma when there is no name', () => {
    expect(greetingFor(at(9), null)).toBe('Good morning!')
    expect(greetingFor(at(9), undefined)).toBe('Good morning!')
    expect(greetingFor(at(9), '   ')).toBe('Good morning!')
  })
})
