begin;
select plan(7);

insert into public.extension_auth_handoffs (
  state_hash, user_id, email, authorized, access_token, refresh_token, expires_at
) values (
  repeat('a', 64), null, 'person@example.com', true, 'access', 'refresh', now() + interval '10 minutes'
);

select is(
  public.claim_extension_auth_handoff(repeat('a', 64)) ->> 'status',
  'claimed',
  'first claim succeeds'
);
select is(access_token, '', 'claim scrubs access token')
from public.extension_auth_handoffs where state_hash = repeat('a', 64);
select is(refresh_token, '', 'claim scrubs refresh token')
from public.extension_auth_handoffs where state_hash = repeat('a', 64);
select ok(claimed_at is not null, 'claim records consumption time')
from public.extension_auth_handoffs where state_hash = repeat('a', 64);
select is(
  public.claim_extension_auth_handoff(repeat('a', 64)) ->> 'status',
  'consumed',
  'replay cannot claim again'
);

insert into public.extension_auth_handoffs (
  state_hash, user_id, email, authorized, access_token, refresh_token, expires_at
) values (
  repeat('b', 64), null, '', false, 'stale-access', 'stale-refresh', now() - interval '1 second'
);
select is(
  public.claim_extension_auth_handoff(repeat('b', 64)) ->> 'status',
  'expired',
  'expired handoff is rejected'
);
select is(
  public.claim_extension_auth_handoff(repeat('c', 64)) ->> 'status',
  'pending',
  'missing handoff remains pending'
);

select * from finish();
rollback;
