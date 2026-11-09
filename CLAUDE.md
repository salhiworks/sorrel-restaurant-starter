@AGENTS.md

## About this project

Sorrel is a restaurant website and dashboard starter. The owner is usually not a developer: explain changes in plain language.

- Keep Demo Mode working with no environment variables at all.
- Never put the Supabase secret key in browser code or in a `NEXT_PUBLIC_` variable.
- Setup steps are in README.md (Profit Studio workflow).
- Connecting Supabase: follow docs/SETUP.md ("For Claude"). Use only the pinned CLI through `npx supabase`; never `db reset`, `migration repair`, `--reveal` or Docker; never ask for a password or the Secret key — the owner runs `npx supabase login` and `npm run setup` in their own terminal.
