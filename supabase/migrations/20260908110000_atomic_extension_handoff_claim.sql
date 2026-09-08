-- Atomically consume one extension handoff and immediately scrub credentials.
-- The row is retained briefly so retries can distinguish consumed from pending.

create or replace function public.claim_extension_auth_handoff(p_state_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  handoff public.extension_auth_handoffs%rowtype;
begin
  if p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid handoff state hash' using errcode = '22023';
  end if;

  select * into handoff
  from public.extension_auth_handoffs h
  where h.state_hash = p_state_hash
  for update;

  if not found then
    return jsonb_build_object('status', 'pending');
  end if;
  if handoff.claimed_at is not null then
    return jsonb_build_object('status', 'consumed');
  end if;
  if handoff.expires_at <= now() then
    update public.extension_auth_handoffs set
      access_token = '', refresh_token = '', claimed_at = now()
    where state_hash = p_state_hash;
    return jsonb_build_object('status', 'expired');
  end if;

  update public.extension_auth_handoffs set
    access_token = '', refresh_token = '', claimed_at = now()
  where state_hash = p_state_hash;

  return jsonb_build_object(
    'status', 'claimed',
    'access_token', handoff.access_token,
    'refresh_token', handoff.refresh_token,
    'user_id', handoff.user_id,
    'email', handoff.email,
    'authorized', handoff.authorized,
    'expires_at', handoff.expires_at
  );
end;
$$;

revoke all on function public.claim_extension_auth_handoff(text)
from public, anon, authenticated;
grant execute on function public.claim_extension_auth_handoff(text)
to service_role;

comment on function public.claim_extension_auth_handoff(text) is
  'Consumes a handoff once under a row lock, returns its former credentials to service_role, and scrubs them from storage.';
