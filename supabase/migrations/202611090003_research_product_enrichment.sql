-- Preserve the existing product JSON as the editorial source of truth.
-- Batch results are separate, versioned supplements and never replace user input.
begin;
create table public.research_product_enrichment (
 id uuid primary key default gen_random_uuid(),
 topic_id uuid not null references public.topics(id) on delete cascade,
 product_id text not null,
 input jsonb not null,
 input_hash text not null,
 result jsonb,
 status text not null default 'pending' check(status in ('pending','running','succeeded','blocked','failed','superseded')),
 attempts integer not null default 0,
 lease_owner uuid,
 lease_expires_at timestamptz,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(topic_id,product_id,input_hash)
);
alter table public.research_product_enrichment enable row level security;
revoke all on public.research_product_enrichment from public,anon,authenticated;
grant select on public.research_product_enrichment to authenticated;
grant all on public.research_product_enrichment to service_role;
create policy product_enrichment_read on public.research_product_enrichment for select to authenticated using(
 private.is_team_member() and exists(select 1 from public.topics t where t.id=topic_id and t.deleted_at is null)
);
create function public.queue_research_products() returns trigger language plpgsql security definer set search_path='' as $$
declare product jsonb;
begin
 if new.deleted_at is not null then return new; end if;
 for product in select value from jsonb_array_elements(case when jsonb_typeof(new.analysis->'products')='array' then new.analysis->'products' else '[]'::jsonb end) loop
  if coalesce(product->>'id','')<>'' and coalesce(product->>'name','')<>'' then
   insert into public.research_product_enrichment(topic_id,product_id,input,input_hash)
   values(new.id,product->>'id',product,md5(product::text)) on conflict do nothing;
  end if;
 end loop;
 return new;
end; $$;
create trigger queue_research_products after insert or update of analysis on public.topics for each row execute function public.queue_research_products();
insert into public.research_product_enrichment(topic_id,product_id,input,input_hash)
select t.id,p->>'id',p,md5(p::text) from public.topics t cross join lateral jsonb_array_elements(case when jsonb_typeof(t.analysis->'products')='array' then t.analysis->'products' else '[]'::jsonb end) p
where t.deleted_at is null and coalesce(p->>'id','')<>'' and coalesce(p->>'name','')<>'' on conflict do nothing;
create function public.claim_research_product(p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.research_product_enrichment%rowtype;
begin
 update public.research_product_enrichment set status='blocked',error_code='lease_expired',lease_owner=null,lease_expires_at=null,updated_at=now()
 where status='running' and lease_expires_at<now() and attempts>=3;
 update public.research_product_enrichment e set status='superseded',lease_owner=null,lease_expires_at=null,updated_at=now()
 where e.status in ('pending','failed','running') and not exists(
  select 1 from public.topics t cross join lateral jsonb_array_elements(case when jsonb_typeof(t.analysis->'products')='array' then t.analysis->'products' else '[]'::jsonb end) p
  where t.id=e.topic_id and t.deleted_at is null and p=e.input
 );
 select * into job from public.research_product_enrichment where (status in ('pending','failed') or (status='running' and lease_expires_at<now())) and attempts<3 order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.research_product_enrichment set status='running',attempts=attempts+1,lease_owner=p_owner,lease_expires_at=now()+interval '10 minutes',updated_at=now() where id=job.id;
 return jsonb_build_object('job_id',job.id,'product',job.input);
end; $$;
create function public.finish_research_product(p_id uuid,p_owner uuid,p_result jsonb default null,p_error text default null) returns text language plpgsql security definer set search_path='' as $$
declare job public.research_product_enrichment%rowtype; next_status text;
begin
 select * into job from public.research_product_enrichment where id=p_id for update;
 if not found or job.status<>'running' or job.lease_owner is distinct from p_owner or job.lease_expires_at<=now() then raise exception 'Lease expired or changed' using errcode='40001'; end if;
 if not exists(select 1 from public.topics t cross join lateral jsonb_array_elements(case when jsonb_typeof(t.analysis->'products')='array' then t.analysis->'products' else '[]'::jsonb end) p where t.id=job.topic_id and t.deleted_at is null and p=job.input) then next_status:='superseded';
 elsif p_error is not null then next_status:=case when p_error in ('product_url_required','product_content_unavailable') or job.attempts>=3 then 'blocked' else 'failed' end;
 else
  if jsonb_typeof(p_result->'fields') is distinct from 'object' or jsonb_typeof(p_result->'evidence') is distinct from 'array' then raise exception 'Invalid product enrichment'; end if;
  next_status:='succeeded';
 end if;
 update public.research_product_enrichment set status=next_status,result=case when next_status='succeeded' then p_result else null end,error_code=p_error,lease_owner=null,lease_expires_at=null,updated_at=now() where id=job.id;
 return next_status;
end; $$;
revoke all on function public.claim_research_product(uuid),public.finish_research_product(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_research_product(uuid),public.finish_research_product(uuid,uuid,jsonb,text) to service_role;
commit;
