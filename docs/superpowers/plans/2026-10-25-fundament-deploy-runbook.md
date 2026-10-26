# Fundament — deploy runbook

Plan: `docs/superpowers/plans/2026-10-25-fundament.md`
Spec: `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md`
Ledger: `.superpowers/sdd/2026-10-25-fundament/progress.md`

This is the order a human must follow to merge and deploy the Fundament branch to the
real environment without breaking the public site or locking out the four owners. It
synthesizes facts already established during planning and review — it does not invent
new ones. Where something is genuinely unknown, it is flagged as an open question
instead of guessed.

Why this matters (see ledger, Task 2 and Task 6; plan Global Constraints):

- The real dev/production database already has a `Henvendelse` table that predates
  any tracked migration (it was added via `prisma db push` or similar, never a
  tracked migration — confirmed read-only against the real `dev.db`). A plain
  `prisma migrate deploy` would have failed on `CREATE TABLE "Henvendelse"` with
  "table already exists" and halted every later migration. **This is now fixed**:
  the catch-up migration
  (`prisma/migrations/20261026100545_henvendelse_pre_existing_table/migration.sql`)
  was changed to `CREATE TABLE IF NOT EXISTS "Henvendelse" (...)`, making it a safe
  no-op on the already-drifted real database while still creating the table
  correctly on any fresh database. Verified by applying the full 5-migration chain
  to a brand-new scratch SQLite file and diffing the result against
  `prisma/schema.prisma` with `prisma migrate diff` — zero drift.
- This plan fully removes the shared `ADMIN_USERNAME`/`ADMIN_PASSWORD` login. The
  four owner accounts (`magnus`, `oystein`, `oskar`, `simen`) must be seeded via
  `prisma db seed` before anyone can log in again, and nobody should be mid-session
  on the old shared login when the switch happens.
- `Bolig.status` is backfilled automatically by the migration itself (migration-tracked,
  not a rerunnable script — see Task 6), but the public read path switches from
  `aktiv` to `status` in the same deploy. A brief mutation freeze (plan Task 6, Step 11)
  must bracket the migrate+deploy step so no owner changes a property's `aktiv`/`status`
  in the window between the migration running and the new read code going live.

## Checklist

1. **Tell the four owners not to edit any property for the duration of this deploy.**
   No one should create, edit, or delete a `Bolig` (status or `aktiv`) or a
   `Delprosjekt` from the moment this checklist starts until Step 8 below ("lift the
   freeze"). This is the mutation freeze from plan Task 6, Step 11 — a short
   operational freeze is the proportional fix for a 4-user internal system, not
   automated multi-instance coordination.

2. **Note the current publicly-visible property IDs** (for the before/after check in
   Step 7). Against the real database, record the `Bolig.id` values where
   `aktiv = true` (today's definition of "publicly visible," before this deploy's
   migration switches the definition to `status IN ('til_salgs', 'klar_for_utleie')`).
   Keep this list somewhere you can compare against after the deploy.

3. **Apply the 5 migrations to the real database:**

   ```bash
   npx prisma migrate deploy
   ```

   Run with `DATABASE_URL` and `TURSO_AUTH_TOKEN` pointed at the real production
   database. This is now safe for the pre-existing `Henvendelse` table per the fix
   above — the catch-up migration is a no-op there, and the status backfill for
   `Bolig` runs automatically as part of the `20261026102645_bolig_eiendom_status`
   migration. See the open question at the end of this checklist about exactly how
   this command reaches the real Turso database in this project's pipeline.

4. **Seed the four owner accounts:**

   Set `SEED_PASSWORD_MAGNUS`, `SEED_PASSWORD_OYSTEIN`, `SEED_PASSWORD_OSKAR`, and
   `SEED_PASSWORD_SIMEN` to real passwords in the real environment (never commit
   these — they are not in any `.env*` file tracked by git). Then run:

   ```bash
   npx prisma db seed
   ```

   This upserts the 4 `AdminUser` rows (`magnus`, `oystein`, `oskar`, `simen`) with
   bcrypt-hashed passwords via `seedAdminUsers()` in `prisma/seed.ts`.

5. **Remove `ADMIN_USERNAME`/`ADMIN_PASSWORD` from the real `.env`/`.env.production`.**
   The shared admin login is fully removed by this plan (no transition period with
   both the old shared login and the new individual accounts active — plan Global
   Constraints). Leaving the old variables in place after this deploy risks a stale
   fallback path being relied on; remove them once Step 4's seeding is confirmed.

6. **Deploy/merge the actual code** (merge this branch to `main` and let it deploy
   through the normal pipeline). Keep this as close as possible to Step 3's migration
   run — Task 6, Step 11 of the plan calls for the migration and the new read code
   (`lib/eiendom.ts`'s status-based queries) to go live in the same window, with no
   admin writes in between.

7. **Confirm the same set of property IDs from Step 2 are still exactly the publicly
   visible ones.** After the deploy, query which `Bolig.id`s are now publicly visible
   under the new definition (`status IN ('til_salgs', 'klar_for_utleie')`, as used by
   `hentOffentligSynligeBoliger`/`hentOffentligSynligBolig` in `lib/eiendom.ts`) and
   compare against the list from Step 2. They must match exactly — any mismatch means
   the backfill or the freeze did not hold, and should be investigated before
   continuing to treat the deploy as successful.

8. **Lift the mutation freeze.** Tell the four owners it's safe to resume editing
   properties and delprosjekter.

## Open question — flag before relying on this runbook

**How exactly do migrations reach the real Turso database in this project's actual
deploy pipeline?** This plan and its review do not know whether Step 3
(`npx prisma migrate deploy`) is run locally by a human against the production
`DATABASE_URL` + `TURSO_AUTH_TOKEN`, as a CI step, or by some other mechanism (e.g. a
Vercel build hook). No CI/CD workflow files were found in this repository
(`.github/`, `vercel.json`, etc. — none present) to confirm this. Whoever performs
this deploy must confirm the actual mechanism before relying on the
migration-tracked-backfill guarantee from Task 6, since the ordering guarantees in
this checklist (migration before/with new code, freeze bracketing both) only hold if
the person deploying controls when the migration actually runs relative to the code
going live.
