# Bunpro import investigation

## Summary

Bunpro does **not** offer an official public API. The team deprecated and removed their legacy API to focus on core product development. Import in this app is a **best-effort** feature built on community-reverse-engineered frontend endpoints, with prominent limitations disclosed in the onboarding import UI.

## Official status

- The legacy `/api/user/**` API has been removed.
- Bunpro staff confirmed there is no stable public API comparable to WaniKani v2.
- The settings-page API key field does not work with the frontend API.

## Unofficial frontend API

Community developers documented internal endpoints the Bunpro web app uses:

| Item | Detail |
| --- | --- |
| Base URL | `https://api.bunpro.jp/api/frontend/` |
| Auth header | `Authorization: Token token=<frontend_api_token>` |
| Token source | Browser cookie `frontend_api_token`, set when visiting `/settings/account` while logged in |
| Mobile constraint | Cookies are not accessible from the native app; users must copy the token manually from browser DevTools |

### Endpoints that generally work

- `/user_stats/srs_level_overview` — aggregate SRS stage counts
- `/user_stats/jlpt_progress_mixed` — JLPT progress by level
- `/user_stats/base_stats` — overall user stats
- `/user_stats/due` — due item counts
- `/user_stats/srs_level_details?level=<stage>&reviewable_type=Grammar` — paginated grammar items per SRS stage (best source for per-point IDs)

### Endpoints that are unstable or broken

- Grammar point title/name lookups — frequently return **500** errors
- Full review history — unreliable
- Complete grammar catalog — only returns a small “next to learn” window

Endpoints may change without warning. A **500** response should be treated as “endpoint unavailable,” not as a transient server error worth aggressive retry.

## Data available for import

- SRS distribution and review counts are reliably available.
- Individual grammar point IDs can be fetched via `srs_level_details` when that endpoint responds.
- Grammar point **names** are often unavailable due to broken title endpoints.
- Mapping to this app’s curriculum depends on `external_id_mappings` rows with `source = 'bunpro'` in `curriculum.db`. Missing mappings are reported as unmatched — never silently dropped.

## Project decision

Implement **best-effort import** when the user supplies a manually obtained frontend token, with:

1. Clear limitation copy in the import UI
2. Explicit alternatives: skip import, or mark grammar manually via onboarding calibration/bulk flows
3. Specific error messages for invalid token, network failure, and unavailable endpoints (NFR18)

## References

- [Bunpro API when? (community forum)](https://community.bunpro.jp/t/bunpro-api-when/100574)
- [Permission to reverse engineer the Bunpro API](https://community.bunpro.jp/t/permission-to-reverse-engineer-the-bunpro-api/164173)
- [OpenClaw skill for Bunpro progress tracking](https://community.bunpro.jp/t/openclaw-skill-for-bunpro-progress-tracking/175471)
- [cbullard-dev/bunpro-community-api](https://github.com/cbullard-dev/bunpro-community-api)
