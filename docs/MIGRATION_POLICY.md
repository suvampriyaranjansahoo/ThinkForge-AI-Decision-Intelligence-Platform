# Migration Policy

`supabase/` is the canonical deployment migration tree.

`db/migrations/` is retained temporarily as a historical compatibility copy because early migrations do not map one-to-one to the current Supabase filenames. It must not be treated as a second deployment source of truth. New migrations must be authored only under `supabase/`.

All overlapping migration pairs from the current package were byte-compared; the matched pairs are identical. The non-one-to-one legacy set is preserved in `db/migrations/` until deployment history is independently verified.

Run `npm run migrations:check` in CI or before a release. It verifies the overlapping compatibility copies have not drifted; it does not deploy anything from `db/migrations/`.
