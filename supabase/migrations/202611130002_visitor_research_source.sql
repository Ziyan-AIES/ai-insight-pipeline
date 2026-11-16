begin;
-- Anonymous provenance is null; never create a shared or fictitious auth user.
alter table public.research_sources alter column created_by drop not null;
alter table public.research_topic_sources alter column linked_by drop not null;
create function public.visitor_research_source(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare source public.research_sources%rowtype; v_topic uuid := (p_input->>'topicId')::uuid; reused boolean;
begin
 if p_input->>'type' not in ('podcast','video','document') or coalesce(p_input->>'url','') !~ '^https?://' then raise exception 'Invalid source'; end if;
 if octet_length(coalesce(p_input->>'body',''))>2097152 or length(p_input->>'description')>12000 then raise exception 'Input too large'; end if;
 perform 1 from public.topics where id=v_topic and deleted_at is null for share;
 if not found then raise exception 'Research unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_input->>'url',0));
 select * into source from public.research_sources where url=p_input->>'url' for update;
 reused:=found;
 if reused and source.deleted_at is not null then raise exception 'Source unavailable'; end if;
 if not reused then
  insert into public.research_sources(type,url,title,publisher,language,description,created_by)
  values(p_input->>'type',p_input->>'url',left(coalesce(p_input->>'title',''),500),left(coalesce(p_input->>'publisher',''),300),coalesce(p_input->>'language','unknown'),coalesce(p_input->>'description',''),null) returning * into source;
  insert into public.research_source_contents(source_id,body,scope,visibility)
  values(source.id,coalesce(p_input->>'body',''),coalesce(p_input->>'scope','excerpt'),'restricted');
 end if;
 insert into public.research_topic_sources(topic_id,source_id,linked_by) values(v_topic,source.id,null)
 on conflict(topic_id,source_id) do update set unlinked_at=null;
 return jsonb_build_object('id',source.id,'reused',reused);
end;
$$;
revoke all on function public.visitor_research_source(jsonb) from public,anon,authenticated;
grant execute on function public.visitor_research_source(jsonb) to service_role;
commit;
