# Landing page at `/`, app Home at `/dashboard`

Date: 2026-11-14. Status: page and routing built; deployed 2026-11-15.

## Intent

A visitor who opens https://paka-paka.app/ sees what PakaPaka is before the app loads. The
page shows the two things that make the app different:

1. **The mnemonic chain.** A radical's picture comes back in the kanji story, and the kanji
   story comes back in the word (as WaniKani does).
2. **Grammar in the same app.** Each grammar point has a lesson, a story mnemonic and typed
   review cards (as Bunpro does), in the same review queue.

The visitor can be a new learner or a learner who uses WaniKani and Bunpro today.

## Goals

- `/` serves the landing page. It loads without the app bundle.
- The app Home is at `/dashboard`.
- **Start** opens the app: onboarding if it is not done, `/dashboard` if it is done.
- The page says that an account is optional: start with no account, sync with an account
  (later), or use a backup file.

## Non-goals

- Sign-in. It needs Part 2 of the
  [accounts and sync design](./2026-11-04-web-app-accounts-sync-design.md). Until then the page
  has no **Log in** button, and the sync card says "Soon".
- A redirect from `/` to `/dashboard` for a user who has progress. `/` always shows the page.
- Changes to `website/` (the old page). It stays as reference.

## Anti-goals

- The page must not tell the visitor that an account is necessary.
- The page must not promise Bunpro import. Most Bunpro imports report unmatched items today
  (`docs/working-history.md`, story 3-3).

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | Plain HTML page. One Cloudflare rule sends `/` to it. | Fast first load; search engines and link previews can read it. Separate from the app code. |
| B | A screen in the Expo app. | One codebase, but the visitor downloads the full app first, and link previews are empty. |
| C | App on a second address. | Clean split, but no `/dashboard` on the same address. |

The operator chose A on 2026-11-14.

## What is built (commit `80759cef`)

- `mobile/public/landing/index.html` with `fonts/` and `img/`. Expo copies `public/` into
  `dist/`, so there is no build step. Today the page is at `/landing/`.
- One file, CSS and script inline. Colours are the app tokens; the page follows the system
  light or dark theme.
- Animations: the hero graph draws itself and tours paths; the radicals fly into the kanji
  card; the grammar answers type themselves. All start states are under the `anim` class,
  which is not set when the visitor asks for reduced motion.
- The mnemonic text, the art and the numbers come from the curriculum.

## Routing design (built 2026-11-14)

1. **Move Home.** `mobile/src/app/(tabs)/index.tsx` becomes `(tabs)/dashboard.tsx`. Update the
   two tab layouts and each `'/'` or `'/(tabs)'` target (onboarding redirect, lesson and
   review end screens, `safeBack`, converse layout) to `/dashboard`.
2. **Keep `/` valid in the app.** A new `mobile/src/app/index.tsx` redirects to `/dashboard`.
   The phone apps open at `/`, so they still open on Home. In the browser this route runs
   only for a link inside the app, because a page load of `/` gets the landing page.
3. **Serve the page at `/`.** `mobile/public/_redirects` with `/ /landing/ 200`. All other
   paths keep the current rule (unknown path → app shell).
4. **One address for search engines.** Add `<link rel="canonical" href="https://paka-paka.app/">`
   to the page, because `/landing/` stays reachable.

No change to onboarding: `useOnboardingRedirect` already sends a new user from `/dashboard` to
onboarding.

## Checks

- Jest and lint pass in `mobile/`.
- `wrangler dev` on the web export: `/` returns the landing page; `/dashboard`, `/browse` and
  an unknown path return the app shell; all responses keep the COOP and COEP headers.
- In the browser: Start with empty storage goes to onboarding; Start after onboarding goes to
  Home; the tab bar, lesson end and review end go to Home.
- On a phone build: the app opens on Home.

## Found while building

- **The `_redirects` rule is sufficient.** `wrangler dev` serves the page at `/` and the app
  shell at all other paths. No Worker is necessary.
- **Back/forward cache held the database.** When the user goes from the app to the landing
  page, the browser can keep the app page alive in its back/forward cache. That page kept its
  SQLite worker, and the worker's file pool (`AccessHandlePoolVFS`) keeps the OPFS files until
  the worker stops. Start then showed "Unable to open local databases". Closing the databases
  does not release the pool. Fix: the expo-sqlite patch stops the worker on `pagehide`, and
  `DatabaseProvider` reloads a page that the browser restores from that cache.
- **The web app has no third-party import and no Talk tab** (`platform/capabilities.ts`). The
  page says so: import is "in the phone app only", and Talk has a "Phone app" label.

## Not done

- An `og:image` for link previews.
- Browser checks of the page in the light theme, at phone width, and with reduced motion.

## Later (Part 2)

Add **Log in** to the nav, the hero and the sync card. The accounts design says "the app never
pushes the user to sign in"; a button on the landing page is an offer, not a gate, so the two
agree.
