begin;
grant select on public.research_sources,public.research_source_contents,public.research_topic_sources to service_role;
create table public.research_source_versions (
 source_id uuid not null references public.research_sources(id),
 source_version integer not null,
 metadata jsonb not null,
 content jsonb not null,
 created_at timestamptz not null default now(),
 primary key(source_id,source_version)
);
alter table public.research_source_versions enable row level security;
revoke all on public.research_source_versions from public,anon,authenticated;
grant select on public.research_source_versions to authenticated;
grant all on public.research_source_versions to service_role;
create policy research_history_read on public.research_source_versions for select to authenticated using(private.is_team_member() and (public.can_access_research_workspace() or exists(select 1 from public.research_sources s where s.id=source_id and s.created_by=auth.uid())));
create table public.research_source_summaries (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.research_sources(id),
 source_version integer not null,
 english_title text not null,
 summary text not null,
 key_points jsonb not null default '[]',
 basis text not null check(basis in ('provided_transcript','provided_excerpt','provided_description')),
 scope text not null check(scope in ('full','excerpt','notes')),
 visibility text not null check(visibility in ('team','restricted')),
 created_at timestamptz not null default now(),
 unique(source_id,source_version)
);
alter table public.research_source_summaries enable row level security;
revoke all on public.research_source_summaries from anon,authenticated;
grant select on public.research_source_summaries to authenticated;
create policy research_summary_read on public.research_source_summaries for select to authenticated using(
 private.is_team_member() and exists(select 1 from public.research_sources s where s.id=source_id and s.version=source_version)
 and (visibility='team' or public.can_access_research_workspace() or exists(select 1 from public.research_sources s where s.id=source_id and s.created_by=auth.uid()))
);
create table public.research_jobs (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.research_sources(id),
 source_version integer not null,
 status text not null default 'pending' check(status in ('pending','running','succeeded','blocked','failed','superseded')),
 lease_owner uuid, lease_expires_at timestamptz,
 attempts integer not null default 0,
 error_code text,
 created_at timestamptz not null default now(),
 unique(source_id,source_version)
);
alter table public.research_jobs enable row level security;
revoke all on public.research_jobs from public,anon,authenticated;
grant all on public.research_jobs,public.research_source_summaries to service_role;
create function public.queue_research_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.research_source_versions(source_id,source_version,metadata,content) select id,version,to_jsonb(s),to_jsonb(new) from public.research_sources s where id=new.source_id on conflict do nothing;
 insert into public.research_jobs(source_id,source_version) select id,version from public.research_sources where id=new.source_id on conflict do nothing;
 return new;
end; $$;
create trigger queue_research_source after insert or update on public.research_source_contents for each row execute function public.queue_research_source();
create function public.claim_research_source(p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.research_jobs%rowtype; result jsonb;
begin
 update public.research_jobs set status='blocked',error_code='lease_expired',lease_owner=null,lease_expires_at=null
 where status='running' and lease_expires_at<now() and attempts>=3;
 select * into job from public.research_jobs where (status in ('pending','failed') or (status='running' and lease_expires_at<now())) and attempts<3 order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.research_jobs set status='running',lease_owner=p_owner,lease_expires_at=now()+interval '10 minutes',attempts=attempts+1 where id=job.id;
 select jsonb_build_object('job_id',job.id,'source_version',job.source_version,'source',to_jsonb(s),'content',to_jsonb(c)) into result from public.research_sources s join public.research_source_contents c on c.source_id=s.id where s.id=job.source_id;
 return result;
end; $$;
create function public.renew_research_lease(p_id uuid,p_owner uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.research_jobs set lease_expires_at=now()+interval '10 minutes' where id=p_id and lease_owner=p_owner and status='running' and lease_expires_at>now();
 return found;
end; $$;
create function public.finish_research_source(p_id uuid,p_owner uuid,p_result jsonb default null,p_error text default null) returns text language plpgsql security definer set search_path='' as $$
declare job public.research_jobs%rowtype; source public.research_sources%rowtype; content public.research_source_contents%rowtype; next_status text;
begin
 select * into job from public.research_jobs where id=p_id for update;
 if not found or job.lease_owner is distinct from p_owner or job.status<>'running' or job.lease_expires_at<=now() then raise exception 'Lease expired or changed' using errcode='40001'; end if;
 select * into source from public.research_sources where id=job.source_id for update;
 if source.version<>job.source_version or source.deleted_at is not null then next_status:='superseded';
 elsif p_error is not null then next_status:=case when p_error='content_unavailable' or job.attempts>=3 then 'blocked' else 'failed' end;
 else
  if coalesce(p_result->>'english_title','')='' or coalesce(p_result->>'summary','')='' or jsonb_typeof(p_result->'key_points')<>'array' then raise exception 'Invalid summary'; end if;
  select * into content from public.research_source_contents where source_id=source.id;
  insert into public.research_source_summaries(source_id,source_version,english_title,summary,key_points,basis,scope,visibility)
  values(source.id,source.version,p_result->>'english_title',p_result->>'summary',p_result->'key_points',
   case when trim(content.body)='' then 'provided_description' when content.scope='full' then 'provided_transcript' else 'provided_excerpt' end,
   case when trim(content.body)='' then 'notes' else content.scope end,
   case when trim(content.body)='' then 'team' else content.visibility end) on conflict(source_id,source_version) do nothing;
  next_status:='succeeded';
 end if;
 update public.research_jobs set status=next_status,error_code=p_error,lease_expires_at=null where id=job.id;
 return next_status;
end; $$;
revoke all on function public.claim_research_source(uuid),public.renew_research_lease(uuid,uuid),public.finish_research_source(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_research_source(uuid),public.renew_research_lease(uuid,uuid),public.finish_research_source(uuid,uuid,jsonb,text) to service_role;
commit;
