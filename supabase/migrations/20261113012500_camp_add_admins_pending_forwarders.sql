-- Camp Rise Again: additive admin access and pending forwarding recipients.
-- Do not alter global Auth settings or any CreatorHub authorization.
-- Preserve all existing admin permissions and verified forwarding mappings.
DO $camp_admins$
DECLARE
  p record;
  old_item text := '''zanibethel@gmail.com''::text';
  extra_items text := '''zanibethel@gmail.com''::text, ''matthias.quellenberg@gmail.com''::text, ''james.campriseagain@gmail.com''::text';
  clauses text;
  touched integer := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE ((schemaname = 'public' AND tablename LIKE 'camp_rise_again_%')
       OR (schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'camp %'))
      AND (coalesce(qual, '') LIKE '%zanibethel@gmail.com%'
        OR coalesce(with_check, '') LIKE '%zanibethel@gmail.com%')
      AND (coalesce(qual, '') NOT LIKE '%matthias.quellenberg@gmail.com%'
        AND coalesce(with_check, '') NOT LIKE '%matthias.quellenberg@gmail.com%')
  LOOP
    clauses := '';
    IF p.qual IS NOT NULL THEN
      clauses := clauses || ' USING (' || replace(p.qual, old_item, extra_items) || ')';
    END IF;
    IF p.with_check IS NOT NULL THEN
      clauses := clauses || ' WITH CHECK (' || replace(p.with_check, old_item, extra_items) || ')';
    END IF;
    EXECUTE format('ALTER POLICY %I ON %I.%I%s',
      p.policyname, p.schemaname, p.tablename, clauses);
    touched := touched + 1;
  END LOOP;
  IF touched NOT IN (0, 18) THEN
    RAISE EXCEPTION 'Unexpected number of Camp policy updates: % (expected 18 or 0)', touched;
  END IF;
END
$camp_admins$;

-- New recipient records are pending until each mailbox owner explicitly
-- confirms a time-limited verification email from the admin portal.
-- Existing recipients are not modified, disabled, or removed.
INSERT INTO public.camp_rise_again_email_forwarders
  (email, display_name, title, inboxes, enabled, verified_at)
VALUES
  ('matthias.quellenberg@gmail.com','Matthias Quellenberg','Camp Rise Again Team',ARRAY['volunteer']::text[],false,NULL),
  ('james.campriseagain@gmail.com','James','Camp Rise Again Team',ARRAY['info']::text[],false,NULL)
ON CONFLICT (email) DO NOTHING;
