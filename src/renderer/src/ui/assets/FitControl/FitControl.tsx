import { TriangleAlert } from 'lucide-react'
import { cx } from '../../atoms/cx'
import { Checkbox } from '../../forms/Checkbox/Checkbox'
import { RadioPillGroup } from '../../forms/RadioPill/RadioPill'
import './FitControl.css'

export type FitChoice = 'fit' | 'fill'

/** The words each screen uses: A11 talks about the circle, A13 about the spot. */
export const FIT_WORDING = {
  circle: { fit: 'Fit inside the circle', fill: 'Fill the circle' },
  spot: { fit: 'Fit inside the spot', fill: 'Fill the spot' }
} as const

export interface FitControlProps {
  value: FitChoice
  onChange: (value: FitChoice) => void
  /** Picks the default wording; `fitLabel` and `fillLabel` override it. */
  target?: keyof typeof FIT_WORDING
  fitLabel?: string
  fillLabel?: string
  /** "How should it fit?" */
  legend?: string
  /** The optional "Replace what’s underneath (…)" checkbox; leave out when nothing is underneath. */
  replace?: { label: string; checked: boolean; onChange: (checked: boolean) => void }
  /** The picture is small: shows "This picture is small, so it may look blurry at this size." */
  lowResolution?: boolean
  className?: string
}

/** "How should it fit?": two pills (fit or fill) and the optional "Replace what's underneath" checkbox. */
export function FitControl({
  value,
  onChange,
  target = 'circle',
  fitLabel,
  fillLabel,
  legend = 'How should it fit?',
  replace,
  lowResolution = false,
  className
}: FitControlProps) {
  const words = FIT_WORDING[target]
  return (
    <div className={cx('as-fit', className)}>
      <RadioPillGroup
        legend={legend}
        value={value}
        onChange={(next) => onChange(next as FitChoice)}
        options={[
          { value: 'fit', label: fitLabel ?? words.fit },
          { value: 'fill', label: fillLabel ?? words.fill }
        ]}
      />
      {replace && (
        <Checkbox label={replace.label} checked={replace.checked} onChange={replace.onChange} />
      )}
      {lowResolution && (
        <p className="as-fit__note" role="status">
          <TriangleAlert size={16} aria-hidden="true" />
          This picture is small, so it may look blurry at this size.
        </p>
      )}
    </div>
  )
}

export { FitControl as FitFillToggle }
