import type { ComponentPropsWithRef } from 'react'
import { cx } from '../cx'
import './TextLink.css'

export type TextLinkProps = ComponentPropsWithRef<'button'>

/**
 * Inline text action ("Skip for now", "Manage"): ink, bold, underlined. It is a real <button>
 * because in this app these navigate or open things rather than leave the page.
 */
export function TextLink({ className, type = 'button', ...rest }: TextLinkProps) {
  return <button type={type} className={cx('ui-text-link', className)} {...rest} />
}
