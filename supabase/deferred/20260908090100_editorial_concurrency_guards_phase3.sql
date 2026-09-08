-- Deferred phase 3: apply manually only after the guarded Netlify caller is
-- deployed and verified. Keeping this file outside migrations prevents a
-- normal `supabase db push` from removing the compatibility RPCs too early.

drop function if exists public.apply_editorial_sync(jsonb, jsonb, text);
drop function if exists public.record_editorial_run_failure(text, text);
