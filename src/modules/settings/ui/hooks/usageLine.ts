import type { UsageSummary } from '@shared/contracts/settings'

/** "This month: about $1.25" (design/screens/02-connect-claude.md §8 step 9). */
export const usageLine = (usage: UsageSummary): string =>
  `This month: about $${usage.costUsd.toFixed(2)}`
