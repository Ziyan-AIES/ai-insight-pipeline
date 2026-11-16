-- Public writes are exposed only through the bounded Netlify endpoint.
-- No anonymous direct table grants, shared user, or extension auth changes.
begin;
create function public.visitor_write(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  item public.news_items%rowtype;
  trend public.trends%rowtype;
  existed boolean;
  v_topic_id uuid := nullif(p_input->>'topicId','')::uuid;
  target_trend uuid := nullif(p_input->>'trendId','')::uuid;
  target_news uuid := nullif(p_input->>'newsId','')::uuid;
begin
  if octet_length(p_input::text)>32768 then raise exception 'Input too large'; end if;
  case p_input->>'action'
  when 'capture' then
    if coalesce(p_input->>'url','') !~ '^https?://' or length(p_input->>'url')>4096 then raise exception 'Invalid URL'; end if;
    if v_topic_id is not null and not exists(select 1 from public.topics where id=v_topic_id and deleted_at is null) then raise exception 'Topic unavailable'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_input->>'url',0));
    select * into item from public.news_items where canonical_url=p_input->>'url' for update;
    existed := found;
    if existed and item.deleted_at is not null then raise exception 'Source unavailable'; end if;
    if not existed then
      insert into public.news_items(canonical_url,title,source,captured_via,editorial_status,metadata)
      values(p_input->>'url',left(coalesce(nullif(p_input->>'title',''),p_input->>'url'),500),'Visitor submission','dashboard','pending',jsonb_build_object('contributor_name',left(coalesce(nullif(p_input->>'contributor',''),'Anonymous'),80),'visitor_submission',true)) returning * into item;
    end if;
    if v_topic_id is not null then
      insert into public.topic_news(topic_id,news_id) values(v_topic_id,item.id)
      on conflict(topic_id,news_id) do update set deleted_at=null,deleted_by=null;
    end if;
    return jsonb_build_object('id',item.id,'canonicalUrl',item.canonical_url,'alreadyExisted',existed,'removed',false,'contributorName',coalesce(item.metadata->>'contributor_name','Anonymous'));
  when 'create_trend' then
    if coalesce(trim(p_input->>'title'),'')='' or length(p_input->>'title')>300 then raise exception 'Invalid title'; end if;
    insert into public.trends(title,category,observation,initial_read,discussion_question,status)
    values(p_input->>'title',(p_input->>'category')::public.news_category,coalesce(p_input->>'observation',''),coalesce(p_input->>'initialRead',''),coalesce(p_input->>'discussionQuestion',''),'active') returning * into trend;
    return jsonb_build_object('id',trend.id,'display_order',trend.display_order,'created_at',trend.created_at,'updated_at',trend.updated_at,'version',trend.version);
  when 'link_trend_source', 'unlink_trend_source' then
    perform 1 from public.trends where id=target_trend and deleted_at is null and status<>'archived' for update;
    if not found then raise exception 'Trend unavailable'; end if;
    perform 1 from public.news_items where id=target_news and deleted_at is null for share;
    if not found then raise exception 'Source unavailable'; end if;
    if p_input->>'action'='link_trend_source' then
      insert into public.trend_news(trend_id,news_id) values(target_trend,target_news)
      on conflict(trend_id,news_id) do update set deleted_at=null,deleted_by=null;
    else
      update public.trend_news set deleted_at=now(),deleted_by=null where trend_id=target_trend and news_id=target_news and deleted_at is null;
    end if;
    return '{}'::jsonb;
  else raise exception 'Unsupported visitor operation';
  end case;
end;
$$;
revoke all on function public.visitor_write(jsonb) from public,anon,authenticated;
grant execute on function public.visitor_write(jsonb) to service_role;
commit;
