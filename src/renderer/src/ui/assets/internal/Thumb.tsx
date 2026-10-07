import { Image as ImageIcon } from 'lucide-react'
import { cx } from '../../atoms/cx'
import './internal.css'

export interface ThumbProps {
  /** Data URL or file URL; null while the thumbnail is being made. */
  src: string | null | undefined
  /** `alt` is empty by default: the title is text beside the picture. */
  alt?: string
  className?: string
}

/** A picture centred in its box, or a quiet placeholder icon while there is none. */
export function Thumb({ src, alt = '', className }: ThumbProps) {
  return (
    <span className={cx('as-thumb', className)} data-empty={src ? undefined : 'true'}>
      {src ? (
        <img className="as-thumb__img" src={src} alt={alt} draggable={false} />
      ) : (
        <ImageIcon className="as-thumb__empty" size={20} aria-hidden="true" />
      )}
    </span>
  )
}
