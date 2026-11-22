# Contributing

Contributions are welcome: code, curriculum content, mnemonics and bug reports.

1. Read [docs/app-overview.md](docs/app-overview.md) to learn how the app works.
2. Check [docs/working-history.md](docs/working-history.md) and [docs/known-issues.md](docs/known-issues.md) before you start, so you do not repeat work.
3. Open an issue to discuss large changes before you send a pull request.
4. Make sure `npm run lint`, `npm run typecheck` and `npm test` pass in `mobile/`. If you change curriculum JSON, run `npm run validate-schema` at the repo root.

To set up the project and run the app, see [docs/development.md](docs/development.md).

## Rules for the codebase

- Functions that can fail return `Result<T, AppError>` (`mobile/src/types/result.types.ts`). They do not throw across async boundaries.
- `curriculum.db` is read-only. Learner data goes in `user.db`. Change the schema only with a numbered migration in `mobile/src/data/migrations/`.
- Use the semantic NativeWind tokens (`bg-background`, `text-primary`, …). Do not use raw hex colors.
- Do not add a feature that needs a network, except in the Talk tab.
