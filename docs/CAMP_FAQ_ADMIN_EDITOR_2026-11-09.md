# Camp Rise Again FAQ admin editing — November 2026

## Where to edit
Sign in to `https://campriseagain.org/admin` using an existing authorized Camp Rise Again admin account. Select **Frequently Asked Questions**.

Switch among **General FAQs**, **Camper FAQs**, and **Volunteer FAQs**. For each page, an admin can:
- Add a new question as an unpublished draft (requires a question and answer).
- Edit an existing question or answer, then save.
- Publish or unpublish individual entries.
- Reorder with drag and drop or accessible Move Up / Move Down buttons.
- Delete an entry with confirmation.
- Open the corresponding public page and see changes without a redeploy.

The original 20 FAQ entries were preserved and seeded to the private `camp_rise_again_faq_items` table: five general, eight camper, and seven volunteer.

## Architecture
- `public.camp_rise_again_faq_items`: question, answer, page section, published state, sort order, updated-at timestamp, editor email, UUID.
- RLS is enabled. `PUBLIC`, `anon`, and `authenticated` roles have no table access. The existing Supabase private bridge uses only its built-in service role after checking a separate server-only bearer.
- Public read: `get_public_faqs` action returns **only published** questions for one of the three known pages; Next.js pages run server-side and dynamically load on each request. No untrusted raw HTML is rendered.
- Admin reads and mutations: `admin_faq_list`, `admin_faq_create`, `admin_faq_update`, `admin_faq_delete`, `admin_faq_reorder` verify an actual Supabase JWT issued for a verified Camp admin email.
- Newly added items default to `is_published=false`.
- Updates require the previously seen `updated_at` timestamp (optimistic edit conflict detection).
- Reordering runs via a service-role-only SQL RPC that verifies the *complete* section's UUIDs, then updates all positions in one transaction. Other pages cannot be reordered by accident.
- All admin HTTP responses carry `Cache-Control: private, no-store`.

No Resend or form-routing changes are included; the FAQ answer pages continue linking to the already working camper, volunteer, and contact forms.

## Review and test
1. Run `npm run test:mail` and `npm run build`.
2. Verify page seed counts, publication counts, privileges, and the reorder function.
3. Deploy the updated `camp-email-bridge` Edge Function to the existing shared Supabase project (only after the branch passes tests).
4. Merge to `main` and verify Vercel production is READY for the merged SHA.
5. Manually test by editing a harmless existing answer in the admin editor, refreshing its public FAQ page, reverting the answer, adding/publishing/unpublishing/removing a temporary question, and checking the ordering.
6. Confirm a non-admin JWT cannot call the admin FAQ endpoint; verify public pages show only published entries.
7. If Supabase temporarily fails, public FAQ pages show a short unavailable message and Contact link rather than exposing drafts or stale unpublished answers.

Do not change camp eligibility, dates, service promises or mental-health emergency guidance without review. `911` and `988` guidance remains in the site content.
