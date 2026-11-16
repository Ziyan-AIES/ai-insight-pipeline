begin;
create table public.research_sources (
 id uuid primary key default gen_random_uuid(),
 type text not null check(type in ('podcast','video','document')),
 url text not null check(url ~ '^https?://'),
 title text not null default '',
 publisher text not null default '',
 language text not null default 'unknown' check(language in ('en','zh','mixed','other','unknown')),
 description text not null default '',
 published_at date,
 created_by uuid not null references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(),
 version integer not null default 1,
 deleted_at timestamptz,
 unique(url)
);
create table public.research_topic_sources (
 topic_id uuid not null references public.topics(id),
 source_id uuid not null references public.research_sources(id),
 linked_by uuid not null references auth.users(id) default auth.uid(),
 linked_at timestamptz not null default now(),
 unlinked_at timestamptz,
 primary key(topic_id,source_id)
);
alter table public.research_topic_sources enable row level security;
revoke all on public.research_topic_sources from anon,authenticated;
grant select on public.research_topic_sources to authenticated;
create policy research_links_read on public.research_topic_sources for select to authenticated using(private.is_team_member());
create table public.research_source_contents (
 source_id uuid primary key references public.research_sources(id),
 body text not null default '' check(octet_length(body)<=2097152),
 scope text not null default 'excerpt' check(scope in ('full','excerpt')),
 visibility text not null default 'team' check(visibility in ('team','restricted'))
);
alter table public.research_sources enable row level security;
alter table public.research_source_contents enable row level security;
revoke all on public.research_sources,public.research_source_contents from anon,authenticated;
grant select on public.research_sources,public.research_source_contents to authenticated;
create policy research_sources_read on public.research_sources for select to authenticated using(private.is_team_member() and (created_by=auth.uid() or public.can_access_research_workspace() or exists(select 1 from public.research_topic_sources l where l.source_id=research_sources.id and l.unlinked_at is null)));
create policy research_contents_read on public.research_source_contents for select to authenticated using(
 private.is_team_member() and (visibility='team' or public.can_access_research_workspace() or exists(select 1 from public.research_sources s where s.id=source_id and s.created_by=auth.uid()))
);
create function public.save_research_source(p_source jsonb,p_body text default '',p_scope text default 'excerpt',p_visibility text default 'team',p_expected_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid; existing public.research_sources%rowtype;
begin
 if not exists(select 1 from public.team_members where user_id=auth.uid() and role in ('editor','admin')) then raise exception 'Editor access required' using errcode='42501'; end if;
 if not exists(select 1 from public.topics where id=(p_source->>'topic_id')::uuid and deleted_at is null) then raise exception 'Research topic not found'; end if;
 if p_source->>'type' not in ('podcast','video','document') then raise exception 'Invalid source type'; end if;
 saved_id := coalesce(nullif(p_source->>'id','')::uuid,gen_random_uuid());
 perform pg_advisory_xact_lock(hashtextextended(p_source->>'url',0));
 select * into existing from public.research_sources where id=saved_id or url=p_source->>'url' for update;
 if found then
   if existing.created_by<>auth.uid() and not public.can_access_research_workspace() and not exists(select 1 from public.research_topic_sources where source_id=existing.id and unlinked_at is null) then raise exception 'Source access required' using errcode='42501'; end if;
   if existing.deleted_at is not null then raise exception 'This source was removed. Restore it before editing.'; end if;
   if p_expected_version is null then
     insert into public.research_topic_sources(topic_id,source_id) values((p_source->>'topic_id')::uuid,existing.id)
     on conflict(topic_id,source_id) do update set unlinked_at=null,linked_at=now(),linked_by=auth.uid();
     return existing.id;
   end if;
   if existing.id<>saved_id or existing.version<>p_expected_version then raise exception 'Source changed. Reload before saving.' using errcode='40001'; end if;
   if existing.created_by<>auth.uid() and not public.can_access_research_workspace() then raise exception 'Source edit access required' using errcode='42501'; end if;
   update public.research_sources set type=p_source->>'type',url=p_source->>'url',title=coalesce(p_source->>'title',''),publisher=coalesce(p_source->>'publisher',''),language=coalesce(p_source->>'language','unknown'),description=coalesce(p_source->>'description',''),published_at=nullif(p_source->>'published_at','')::date,version=version+1 where id=saved_id;
 else
   insert into public.research_sources(id,type,url,title,publisher,language,description,published_at) values(saved_id,p_source->>'type',p_source->>'url',coalesce(p_source->>'title',''),coalesce(p_source->>'publisher',''),coalesce(p_source->>'language','unknown'),coalesce(p_source->>'description',''),nullif(p_source->>'published_at','')::date);
 end if;
 insert into public.research_source_contents(source_id,body,scope,visibility) values(saved_id,p_body,p_scope,p_visibility)
 on conflict(source_id) do update set body=excluded.body,scope=excluded.scope,visibility=excluded.visibility;
 insert into public.research_topic_sources(topic_id,source_id) values((p_source->>'topic_id')::uuid,saved_id)
 on conflict(topic_id,source_id) do update set unlinked_at=null;
 return saved_id;
end; $$;
revoke all on function public.save_research_source(jsonb,text,text,text,integer) from public,anon;
grant execute on function public.save_research_source(jsonb,text,text,text,integer) to authenticated;
create function public.unlink_research_source(p_topic_id uuid,p_source_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.team_members where user_id=auth.uid() and role in ('editor','admin')) then raise exception 'Editor access required' using errcode='42501';end if;
 update public.research_topic_sources set unlinked_at=now() where topic_id=p_topic_id and source_id=p_source_id and unlinked_at is null;
end; $$;
revoke all on function public.unlink_research_source(uuid,uuid) from public,anon;
grant execute on function public.unlink_research_source(uuid,uuid) to authenticated;
create function public.capture_research_news(p_url text,p_title text,p_publisher text,p_topic_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.news_items%rowtype; was_existing boolean; member_name text;
begin
 select display_name into member_name from public.team_members where user_id=auth.uid() and role in ('editor','admin');
 if not found then raise exception 'Editor access required' using errcode='42501'; end if;
 if p_url !~ '^https?://' then raise exception 'Invalid URL'; end if;
 if p_topic_id is not null and not exists(select 1 from public.topics where id=p_topic_id and deleted_at is null) then raise exception 'Topic not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_url,0));
 select * into saved from public.news_items where canonical_url=p_url for update;
 was_existing:=found;
 if not was_existing then
  insert into public.news_items(canonical_url,title,source,captured_by,captured_via,metadata)
  values(p_url,coalesce(nullif(p_title,''),p_url),p_publisher,auth.uid(),'dashboard',jsonb_build_object('contributor_name',member_name))
  on conflict(canonical_url) do nothing;
  select * into saved from public.news_items where canonical_url=p_url;
 end if;
 if saved.deleted_at is not null then raise exception 'This source is in the recycle bin. Restore it first.'; end if;
 if p_topic_id is not null then
  insert into public.topic_news(topic_id,news_id,linked_by) values(p_topic_id,saved.id,auth.uid())
  on conflict(topic_id,news_id) do update set deleted_at=null,deleted_by=null;
 end if;
 return jsonb_build_object('id',saved.id,'canonicalUrl',saved.canonical_url,'alreadyExisted',was_existing,'removed',false,'contributorName',coalesce(saved.metadata->>'contributor_name',member_name));
end; $$;
revoke all on function public.capture_research_news(text,text,text,uuid) from public,anon;
grant execute on function public.capture_research_news(text,text,text,uuid) to authenticated;
commit;
