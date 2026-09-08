-- Phase 3: the guarded Netlify caller passed a controlled production run on
-- 2026-09-09. Remove the legacy unguarded completion and failure RPCs.

drop function if exists public.apply_editorial_sync(jsonb, jsonb, text);
drop function if exists public.record_editorial_run_failure(text, text);
