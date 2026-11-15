# Security policy

## How to report a problem

Please report security problems in private. Do not open a public issue.

Use GitHub private vulnerability reporting:
https://github.com/riyaz942/PakaPaka/security/advisories/new

Tell us what you found, the steps to repeat it, and which part it affects.

## What is in scope

- The backend (the Cloudflare Worker in `backend/`)
- The web app
- The mobile app (Android and iOS)

## What never reaches the server

- Your AI provider keys (BYOK). They stay in secure storage on your device and go only to the endpoint you set.
- Your AI conversations. They stay on your device.
- Your email address.

The server does not log tokens.

## Hosting

The backend runs on the free Cloudflare plan. If a limit is reached, it fails closed: it refuses the request instead of letting it through.

## What to expect

This is a free, open-source project run by one person. We aim to reply within 7 days and to fix confirmed problems as soon as we can. We do not run a bounty program.
