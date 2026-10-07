/**
 * The User-Agent every image-library request carries. Wikimedia's policy asks for `<client>/<version> (<contact>)`,
 * so a real project address is needed before the app is handed out.
 *
 * OWNER: replace `WIKIMEDIA_CONTACT` below with a project web page or an e-mail address (agents/ASSETS.md §10,
 * question 4). It is the only place that holds it.
 */
export const WIKIMEDIA_CONTACT = 'https://example.org/slide-planner-contact-placeholder'

export const CLIENT_NAME = 'SlidePlanner'

/** `SlidePlanner/0.1.0 (https://…; desktop lesson planner)`. */
export const slidePlannerUserAgent = (version = '0.1'): string =>
  `${CLIENT_NAME}/${version} (${WIKIMEDIA_CONTACT}; desktop lesson planner)`
