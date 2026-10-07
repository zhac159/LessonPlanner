import './connect.css'

export const CONSOLE_URL = 'https://platform.claude.com/'

/** "platform.claude.com ↗": the shell opens http(s) links in the default browser, never in-app. */
export function ConsoleLink() {
  return (
    <a className="console-link" href={CONSOLE_URL} target="_blank" rel="noreferrer">
      platform.claude.com ↗
    </a>
  )
}
