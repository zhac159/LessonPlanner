# Image providers for "Your assets" (verified facts, formats, costs, recommendation)

Status: written and live-tested on **2026-10-07** by the provider-layer task. Code: `src/main/services/imageProviders/`
(pure TypeScript over an injected `fetchFn`, never Electron; every call runs in main, the renderer is offline).
Everything below marked "live" was observed by running the code against the real service; "docs" means read from the
official documentation on that date; "not verified" is said explicitly.

## 1. Recommendation (what to ship by default)

| Provider | Key | Ship | Why |
|---|---|---|---|
| **Wikimedia Commons** | none | default, on | Best licence data (licence, artist, credit, "attribution required"), fast (~0.8 s), generous limits, great for the teacher's kinds of pictures (cave paintings, animals, diagrams). |
| **Openverse** | none (optional free OAuth) | default, on | One search over Flickr, museums, Wikimedia and more with licence filter built in. **Anonymous limit is tight: 20 searches/min and 200/day**, so the app caches and spaces requests and shows a friendly "try later" message. |
| **Pexels** | free key | optional, off until a key is pasted | Clean stock photos, simple rules, 200 requests/hour and 20,000/month. Fine as a "Settings > Extra libraries" row. |
| **Unsplash** | free key | **not in v1** (code exists, keep it unwired) | Demo apps get only 50 requests/hour, production needs an approval form, the guidelines require hotlinked URLs plus a download ping, which fights with "save the picture into the library". |
| **Nano Banana Pro** (`gemini-3-pro-image`) | Google AI Studio key on a **paid** project | optional ("Add a picture maker"), as the owner decided | The only AI picture maker wired. Offer **`gemini-nano-banana-2.1`** as the "faster and cheaper" choice (a quarter to two fifths of the price, section 6.5). |

"Free to use in lessons" = CC0, public domain, CC BY, CC BY-SA (plus the Pexels/Unsplash licences). NC and ND are
dropped unless the teacher switches the filter off, and then each result carries `commercialOk: false` for the UI.

## 2. Code map

| File | Role |
|---|---|
| `types.ts` | `ImageSearchProvider`, `ImageSearchItem`, `LicenceInfo`, `FetchFn`, `DEFAULT_USER_AGENT` |
| `openverse.ts`, `commons.ts`, `keyed.ts` (Pexels + Unsplash) | the search providers |
| `licences.ts` | `licenceFromCode`, `parseLicenceText`, `isFreeToUse` |
| `limits.ts` | `createThrottle`, `createQueryCache`, `polite(provider)` (spacing plus in-memory cache with in-flight sharing) |
| `index.ts` | `createSearchProviders({ fetchFn, userAgent, getPexelsKey?, getUnsplashKey?, getOpenverseToken? })` returns the throttled, cached providers |
| `download.ts` | `downloadImage(url, opts)`: https only, no private hosts, 3 manual redirects, 10 MB cap (header and stream), 30 s deadline, abort signal, type from magic bytes, SVG refused unless `allowSvg` and then sanitised with `sanitiseSvg` |
| `nanoBanana.ts` | `createNanoBananaMaker({ getKey, fetchFn, model })`, `PictureMaker`, `mapGeminiHttpError`, `estimatePictureCost` |
| `attribution.ts` | `attributionCredit(asset)` and `creditsForNotes(assets)` for speaker notes |
| `errors.ts`, `text.ts`, `http.ts` | `ImageProviderError` (code = `@shared/result` ErrorCode), `guard()` to return a `Result`, HTML cleanup, JSON requests with typed failures |

Searches **throw** `ImageProviderError` (`code`, `message`, `retryAfterSeconds?`); wrap in `guard(() => provider.search(...))`
or `toFailure(error)` to return a `Result` over IPC. `makeImages` returns a `Result` and never throws.

User-Agent: Wikimedia's policy wants `<client>/<version> (<contact>)`. `DEFAULT_USER_AGENT` has no contact; the shell
should pass `userAgent` built from `app.getVersion()` plus a project contact URL or address (owner decision, section 9).
Do **not** use the teacher's personal email.

## 3. Openverse (live + docs)

- Endpoint: `GET https://api.openverse.org/v1/images/`. Anonymous use works (no key). OpenAPI schema: `/v1/schema/?format=json`.
- Parameters used: `q`, `page`, `page_size` (**max 20 for anonymous**, a 500 gets `401 "page_size may not exceed 20 for anonymous requests"`), `license=cc0,pdm,by,by-sa` (any of `by, by-nc, by-nc-nd, by-nc-sa, by-nd, by-sa, cc0, nc-sampling+, pdm, sampling+`; an unknown value is a 400 with a clear message), `category=photograph|illustration|digitized_artwork`, `mature=false`. Also available: `license_type=all|all-cc|commercial|modification`, `extension`, `aspect_ratio=square|tall|wide`, `size=large|medium|small`, `source`, `excluded_source`, `filter_dead` (default true).
- Rate limits (live, response headers `x-ratelimit-limit-anon_burst: 20/min`, `x-ratelimit-limit-anon_sustained: 200/day`, plus `x-ratelimit-available-*`). A throttled call is HTTP 429 with a body like `Request was throttled. Expected available in N seconds.`; the code reads both that and `Retry-After`. Registering an application (`POST /v1/auth_tokens/register/`, then `POST /v1/auth_tokens/token/` with client credentials, bearer token) gives "standard" limits; the schema says "enhanced" exists on request. The exact registered numbers were **not verified** (not in the schema text).
- Result fields (live): `id, title, foreign_landing_url, url, creator, creator_url, license, license_version, license_url, provider, source, category, filesize, filetype, tags, attribution, mature, height, width, thumbnail, detail_url`. `url` is the original on the source site (often Flickr `_b.jpg`, about 1024 px, hotlink-able); `thumbnail` is `https://api.openverse.org/v1/images/<id>/thumb/` (proxied by Openverse).
- Response: `{ result_count, page_count, page_size, page, results[] }`.
- **Surprises (live):** (1) `title` and `creator` of items that originate on Wikimedia sometimes contain raw HTML or whole wikitext blocks (`<div class='fn'>...`, `QS:P1476,...`): the provider strips tags and clips to 120/100 characters. (2) The thumbnail endpoint answers **HTTP 406 to `Accept: image/*`**; send `image/*,*/*;q=0.8` (download.ts does). (3) `filetype` is null for many results, so SVG is excluded by URL extension too.
- Licence terms: results carry their own CC licence; the app must credit as the licence requires. Openverse itself only asks to be used within the rate limits (full terms: https://openverse.org/terms, not re-read here).

## 4. Wikimedia Commons (live + docs)

- Endpoint: `GET https://commons.wikimedia.org/w/api.php`, no key. Parameters used (all verified live):
  `action=query&format=json&formatversion=2&generator=search&gsrnamespace=6&gsrsearch=<terms> filetype:bitmap&gsrlimit=<=50&gsroffset=<n>&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=330&iiextmetadatafilter=ObjectName|LicenseShortName|License|LicenseUrl|Artist|Credit|AttributionRequired|Copyrighted`.
  `filetype:bitmap|drawing` also works (adds SVG drawings). Next page: `continue.gsroffset` (the response has a `continue` object when more exist; the code pages with `gsroffset = (page-1) * limit`).
- **Pages come back in arbitrary order**: sort by `index`. Page objects: `pageid, title ("File:..."), index, imageinfo[0] = { size, width, height, thumburl, thumbwidth, thumbheight, url, descriptionurl, mime, extmetadata }`.
- `extmetadata.<Field>.value` is **HTML** for `Artist`, `Credit`, `ImageDescription`; `LicenseShortName` ("CC BY-SA 4.0", "Public domain", "CC0"), `License` ("cc-by-sa-4.0"), `LicenseUrl`, `UsageTerms` ("Creative Commons Attribution-Share Alike 4.0"), `AttributionRequired` ("true"), `Copyrighted`, `Restrictions` (trademark, personality rights...; **not used yet**, see concerns).
- **Licence filtering is client-side** (the search cannot filter by licence): `parseLicenceText` reads `LicenseShortName` then `License`; anything not recognised (GFDL, "Attribution" text only...) is `other` and dropped when `freeOnly`.
- Thumbnails: Commons only renders standard widths (20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840), hence `330px` when 320 is asked. **Originals over 8 MB** (often 20+ MB scans) are replaced by the 1920 px rendering; **SVG is never downloaded as SVG**: the 1280 px PNG rendering is used (live: 275 KB PNG), which also keeps diagrams safe.
- User-Agent: the policy (foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy) requires `<client name>/<version> (<contact>) <library>/<version>`. Live: a request with **no User-Agent got HTTP 429** with an HTML error page; a descriptive one is fine. The provider sends both `User-Agent` and `Api-User-Agent`. The thumbnail host (`thumb.wikimedia.org`) and `upload.wikimedia.org` served images without a UA in my test, but downloads send it anyway.
- Rate limits: no published number found; the policy only says to be polite. The throttle spaces requests 500 ms, serially.
- Licences: each file page carries the licence; credit as the licence requires (author, title, licence name and URL, link to the file page).

## 5. Pexels and Unsplash (docs only, not live-tested, keys needed)

**Pexels** (pexels.com/api/documentation, read 2026-10-07)
- `GET https://api.pexels.com/v1/search?query=&page=&per_page=` (max 80), header `Authorization: <key>` (the raw key, no prefix). Optional `orientation, size, color, locale`.
- Response: `{ page, per_page, total_results, next_page, photos[] }`; photo: `id, width, height, url, photographer, photographer_url, alt, avg_color, src{ original, large2x, large, medium, small, portrait, landscape, tiny }`. The provider uses `src.large2x` (about 1880 px wide) and `src.medium` for the grid.
- Limits: **200 requests/hour, 20,000/month** (headers `X-Ratelimit-Limit/Remaining/Reset`), raisable on request.
- Rules: show a prominent link to Pexels and "always credit photographers when possible" ("Photo by [Name] on Pexels"); no replicating Pexels' core product; no abuse. The Pexels licence allows free use without credit, so `requiresAttribution` is true here only because the API terms ask for it.

**Unsplash** (unsplash.com/documentation and help.unsplash.com API guidelines, read 2026-10-07)
- `GET https://api.unsplash.com/search/photos?query=&page=&per_page=` (max 30), header `Authorization: Client-ID <access key>`, `Accept-Version: v1`. `content_filter=high` used.
- Response: `{ total, total_pages, results[] }`; photo: `id, width, height, description, alt_description, urls{ raw, full, regular(1080 w), small(400 w), thumb(200 w) }, links{ html, download_location }, user{ name, links.html }`.
- Limits: **demo 50 requests/hour; production 1,000/hour after an approval review**.
- Rules: (1) use the API's hotlinked `urls.*` (keep `ixid`); (2) **trigger `GET links.download_location` when the user actually picks the photo** (this is `provider.registerUse(item)`); (3) credit Unsplash and the photographer with links carrying `?utm_source=<app>&utm_medium=referral` (done: `utm_source=slide_planner`); (4) keep the key confidential (main only); (5) no unofficial-client use, no selling photos.

## 6. Nano Banana Pro through the Gemini API (docs + a live probe with a deliberately wrong key)

No Google key was available, so the success path is built from the documentation and tested with handwritten fixtures. The error
shapes for a bad key were recorded live (a fake key against the real endpoint).

### 6.1 Models (ai.google.dev/gemini-api/docs/image-generation and /models, read 2026-10-07)

| Name | Model id | Notes |
|---|---|---|
| Nano Banana Pro | **`gemini-3-pro-image`** (stable; the older `-preview` id is only still used in the rate-limit page) | "Premium choice for the most complex visual tasks". Latest update: Nov 2025. Input image+text, output image+text, 65,536 in / 32,768 out tokens. |
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | Docs' "primary workhorse" for new projects: Flash-level speed and cost, better text rendering and multi-turn consistency. |
| Nano Banana 2 | `gemini-3.1-flash-image` | Previous workhorse; adds 512 px output. |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | Fastest and cheapest, 1K only, "not optimized for multiple reference inputs". |
| Nano Banana (legacy) | `gemini-2.5-flash-image` | **Deprecated, shuts down 2026-10-02** (already past). Do not use. |

Imagen is shut down. All generated images carry a **SynthID** invisible watermark (nothing to strip or show; mention it in the privacy note).

### 6.2 The two API styles

The docs now present the **Interactions API** (`POST /v1beta/interactions`, `{"model", "input":[{"type":"text"},{"type":"image","mime_type","data"}], "response_format":{"type":"image","aspect_ratio","image_size"}}`) as GA and recommended for new projects (June 2026), and call `generateContent` "legacy" but "remains fully supported". The Interactions API does not support custom safety settings. **The code uses `generateContent`** because its response shape is documented in detail and stable; `buildRequestBody` and `readImage` are the only two places to change if Google retires it. Live, both endpoints reject a fake key the same way (the Interactions endpoint wraps the error in an array, which `mapGeminiHttpError` handles). I did **not** verify the Interactions *response* shape beyond the migration guide's concept (`steps[].content[]` of `{type:"image", mime_type, data}`).

### 6.3 Request (generateContent)

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent
x-goog-api-key: <key>            (header only; never in the URL)
content-type: application/json

{
  "contents": [{ "role": "user", "parts": [
    { "text": "A Bunsen burner with a lit flame, same flat style as the pictures" },
    { "inlineData": { "mimeType": "image/png", "data": "<base64>" } }      // 0..N reference pictures
  ]}],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"],
    "imageConfig": { "aspectRatio": "16:9", "imageSize": "2K" }
  }
}
```

- `aspectRatio`: `1:1, 1:4, 4:1, 1:8, 8:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9` (the maker's type uses the common ten). If omitted, the model follows the reference pictures. `imageSize`: `512` (Flash models only), `1K`, `2K`, `4K`; default 1K. **The API reference marks `responseModalities` and `imageConfig` as deprecated in favour of `generationConfig.responseFormat.image { mimeType, aspectRatio, imageSize }`**; both still work, the replacement was not live-tested and its MIME enum values were not read.
- References: up to 14 total. For Pro: **6 object images + 5 character images + 3 style references**. The maker sends at most 6 (configurable), PNG/JPEG/WebP only.
- Thinking is always on for Gemini 3 image models and cannot be disabled; up to two interim "thought" images are generated (not charged) and the last image is the final one. Parts with `thought: true` are ignored.
- One request returns **one picture**. "2 or 4 versions" = 2 or 4 requests (concurrency 2); a failure that cannot improve (bad key, no credit, safety block) stops the rest.

### 6.4 Response and failures

Success: `candidates[0].content.parts[]` holds `{text}` parts and `{inlineData:{mimeType, data(base64)}}` (docs examples show `image/jpeg` and `image/png`; the maker accepts PNG/JPEG/WebP by magic bytes and returns `{bytes, mime}`; converting to PNG is the caller's job if it needs PNG). Blocks: `promptFeedback.blockReason` (e.g. `PROHIBITED_CONTENT`) or `candidates[0].finishReason` in `SAFETY, IMAGE_SAFETY, PROHIBITED_CONTENT, IMAGE_PROHIBITED_CONTENT, IMAGE_RECITATION, RECITATION, BLOCKLIST, SPII, IMAGE_OTHER, NO_IMAGE, OTHER` with no image part.

Mapping (`mapGeminiHttpError`, `readImage`):

| Situation | HTTP / signal | ErrorCode |
|---|---|---|
| Wrong, expired or revoked key | **HTTP 400**, `error.status: INVALID_ARGUMENT`, `details[].reason: API_KEY_INVALID`, message "API key not valid. Please pass a valid API key." (live; not 401!) | `invalid-key` |
| No key sent | HTTP 403 `PERMISSION_DENIED`, "Method doesn't allow unregistered callers" (live) | `invalid-key` |
| No billing / prepay balance 0 | HTTP **402** "Payment Required" (docs: prepay credit depleted; all keys of that billing account stop); also 400 `FAILED_PRECONDITION` for disabled billing; free-tier key: 429 `RESOURCE_EXHAUSTED` with `limit: 0` (expected for image models, not live-verified) | `no-credit` |
| Daily quota | 429, reason `QUOTA_EXCEEDED` | `no-credit` (with the wait if given) |
| Per-minute limit | 429 `RESOURCE_EXHAUSTED`, `RetryInfo.retryDelay: "34s"` | `rate-limited` (+ `retryAfterSeconds`) |
| Key lacks permission / region | 403 `PERMISSION_DENIED`; 400 "User location is not supported" | `permission` |
| Model id retired | 404 | `model-unavailable` |
| Safety / policy block, or text-only refusal | 200 with block fields above | `refused` |
| Too busy / deadline | 500-504 | `overloaded` |
| No connection, timeout (180 s) | fetch throws | `network` |
| Caller aborted | AbortSignal | `cancelled` |

### 6.5 Cost, free tier, data terms, getting a key (docs, 2026-10-07)

- **No free tier for any image model.** Pro standard paid tier: **$0.134 per 1K or 2K picture, $0.24 per 4K** (output $120 per million image tokens; each reference image about 560 input tokens, about $0.0011). Batch/Flex about half (not usable through this code). Nano Banana 2.1: $0.0336 (1K), $0.0504 (2K), $0.113 (4K). Nano Banana 2 Lite: $0.0336 (1K). So **2K costs the same as 1K on Pro: the maker defaults to 2K**. 4 versions on Pro = about **$0.54**. `estimatePictureCost(model, size, count)` returns this for the usage log.
- Billing: a project moves to the paid tier by linking a billing account and **prepaying at least $5**; credits expire after 12 months, non-refundable; at $0 all keys on that account get HTTP 402. (Prepay/Postpay plans take effect from 2026-03-23.)
- **Data terms:** on the free tier Google may use content to improve its products; on the paid tier it does not. Since image models need the paid tier, the pictures and prompts sent are not used for training. The Prohibited Use Policy applies, and the docs remind users to have rights to any uploaded images (the teacher's own decks: fine; do not send pupil photos).
- **How the teacher gets a key:** https://aistudio.google.com/apikey, sign in with a Google account, accept the terms (a default Google Cloud project is created), **Create API key**; then in AI Studio set up billing for that project (Set up billing, prepay at least $5). Since 2026-05-28 new keys are "auth keys" bound to a service account and **unrestricted standard keys are rejected**; the keys AI Studio creates now work with the same `x-goog-api-key` header (the doc's curl example uses it). Test button copy for A7 should say the key works but picture making also needs billing.
- Rate limits per tier are only visible in AI Studio (aistudio.google.com/rate-limit); the public page lists image-token limits per minute (Pro: 2,000,000 TPM and 270,000,000 per day in the table read) but no per-model request numbers.

## 7. Licence and credit handling in the data model

Every online asset should store: `providerId`, item `id`, `source`, `sourceUrl`, `author`, `authorUrl?`, `licence {code, name, url, requiresAttribution, commercialOk}`, `title`, the credit line and `retrievedAt`. `attributionCredit(asset)` builds one plain line, e.g.
`"Leaf In Sunlight" by The Webhamster, CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0/). Source: Flickr (https://www.flickr.com/photos/40041412@N06/3999881122).`
Pexels/Unsplash: `Photo by Jane Doe (https://www.pexels.com/@jane) on Pexels (https://www.pexels.com/photo/...).`
AI pictures: `Picture made with Nano Banana Pro (AI-generated).` Her own uploads give an empty line. `creditsForNotes(assets)` returns one "Picture credits: ..." paragraph with unique lines, or ''.
Note on **CC BY-SA**: a share-alike licence applies to adaptations of the picture; a slide deck that merely shows it is generally treated as a collection, but this is a legal grey area and the app should not claim otherwise.

## 8. Live smoke result (2026-10-07, 20 results per page, free-only)

| Query | Openverse | Wikimedia Commons |
|---|---|---|
| "leaf in sunlight" | 20 items (CC BY 14, CC BY-SA 4, CC0 2), 0.2 to 2.4 s | 19 items (CC BY-SA 7, CC BY 9, CC0 2, public domain 1), 0.9 to 1.2 s |
| "cave painting" | 20 items (CC BY-SA 11, CC BY 8, CC0 1), 1.9 to 2.2 s | 20 items (CC BY-SA 11, CC BY 4, public domain 3, CC0 2), 0.8 s |

Both had more pages. Without the free filter, Openverse "cave painting" returned a licence mix where 10 of 20 were NC or ND, which is what the filter protects against. Downloads: Commons original 775 KB JPEG and 330 px thumbnail 26 KB; Openverse full 62 KB JPEG and proxied thumbnail 42 KB (after the Accept fix); a Commons SVG diagram arrived as a 275 KB PNG rendering. Commons search for "water cycle diagram" with `filetype:bitmap|drawing` returned 10 results of which several are SVG renderings.

## 9. Open items and risks

- **Contact for the User-Agent** (Wikimedia): needs a project address or URL from the owner.
- **Openverse 200 searches/day anonymous**: a heavy planning day (each A9 search plus each "Find online" tab on a picture spot) could reach it. Mitigation in code: 10-minute cache, 20-per-minute spacing. Recommended next step: register one Openverse application and ship its client credentials (or ask each teacher to), then pass `getOpenverseToken`. Registered limits not verified.
- **Commons `Restrictions`** (personality rights, trademarks) and photographs of identifiable people: not filtered; the review step (A2) is the safety net, as the proposal already says.
- **Commons metadata can be messy** (an `Artist` that is a file name, wikitext in titles); text is cleaned and clipped but still not always pretty.
- **The Interactions API** may become the only supported Gemini path someday; the swap is local (`buildRequestBody`, `readImage`) but untested against real responses.
- **No live test of the Google, Pexels or Unsplash success paths** (no keys). Their tests use handwritten fixtures built from the docs.
