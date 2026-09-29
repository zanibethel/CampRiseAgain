# Camp Rise Again Supabase migrations

These files mirror the migration history already applied to the shared CreatorHub Supabase project for Camp Rise Again.

Production project ref: `yufptpfiwdbzzrvhkvux`.

The timestamp prefixes match `supabase_migrations.schema_migrations.version` so the repository and live database can be reconciled without inventing replacement migrations.

As of 2026-09-29, the Camp Rise Again migration history covers:

- camper and volunteer application tables
- editable homepage settings and schedule
- public-read/admin-write RLS policies and grants
- GoFundMe URL setting
- Meet the Staff table plus public image storage
- Resources table and initial support-resource seed data
- homepage section ordering and managed branding storage
- editable homepage copy fields

Do not manually rerun these migrations against the existing production project. They are source-of-truth history for reproducible environments and future Supabase CLI reconciliation.
