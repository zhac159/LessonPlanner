import { Tooltip, cx } from '../../atoms'
import './ColourRole.css'

export interface ColourRoleProps {
  /** The colour as a hex string, e.g. "#0E7C7B". Shown in the tooltip. */
  hex: string
  /** The colour's name, in bold: "Teal". */
  label: string
  /** What the colour is used for: "titles, accents, left band". */
  usage: string
  className?: string
}

/** One learned colour: a swatch with its name and what she uses it for ("Teal · titles, accents"). */
export function ColourRole({ hex, label, usage, className }: ColourRoleProps) {
  return (
    <div className={cx('colour-role', className)}>
      <Tooltip label={hex}>
        <span
          className="colour-role__swatch"
          role="img"
          aria-label={`${label} swatch ${hex}`}
          tabIndex={0}
          style={{ background: hex }}
        />
      </Tooltip>
      <span className="colour-role__text">
        <strong>{label}</strong>
        {' · '}
        <span>{usage}</span>
      </span>
    </div>
  )
}
