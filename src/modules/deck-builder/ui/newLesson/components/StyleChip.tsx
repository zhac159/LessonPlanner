import { Plus } from 'lucide-react'
import type { StyleSummary } from '@shared/contracts/style-library'
import { SwatchDot } from '@ui/atoms'
import { SelectChip, type SelectChipOption } from '@ui/forms'

/** The value of the "Create a new style…" menu entry. */
export const NEW_STYLE = '__new-style__'
const PLAIN = '__plain__'

export interface StyleChipProps {
  styles: ReadonlyArray<StyleSummary>
  /** The chosen style id; null is the plain style. */
  styleId: string | null
  /** Locked while slides are being made. */
  disabled?: boolean
  onChange(styleId: string | null): void
  /** "Create a new style…" was chosen. */
  onCreateStyle(): void
}

/** The menu: her styles (a coloured dot each), "Plain style" when she has none, then "Create a new style…". */
export function styleOptions(styles: ReadonlyArray<StyleSummary>): SelectChipOption[] {
  const options: SelectChipOption[] =
    styles.length === 0
      ? [{ value: PLAIN, label: 'Plain style', leading: <SwatchDot color="var(--line-muted)" /> }]
      : styles.map((style) => ({
          value: style.id,
          label: style.name,
          leading: <SwatchDot color={style.primaryHex} />,
          fill: style.tintHex
        }))
  options.push({
    value: NEW_STYLE,
    label: 'Create a new style…',
    leading: <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
  })
  return options
}

/** "Your style: Science KS3" (05 §5, §8.7): a SelectChip over the style library. */
export function StyleChip({ styles, styleId, disabled, onChange, onCreateStyle }: StyleChipProps) {
  const value = styles.some((s) => s.id === styleId) ? (styleId ?? PLAIN) : PLAIN
  return (
    <SelectChip
      label="Your style"
      className="nl-style-chip"
      options={styleOptions(styles)}
      value={value}
      disabled={disabled}
      onChange={(next) => {
        if (next === NEW_STYLE) onCreateStyle()
        else onChange(next === PLAIN ? null : next)
      }}
    />
  )
}
