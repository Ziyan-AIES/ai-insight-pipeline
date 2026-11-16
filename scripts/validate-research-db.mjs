// Isolated PostgreSQL fixture. Never connects to production.
// Run after npm ci; PGlite is a pinned development dependency.
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite()
await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth; create schema private; grant usage on schema private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,service_role;
 create table auth.users(id uuid primary key);
 create table public.team_members(user_id uuid primary key references auth.users(id),role text,display_name text);
 create function private.is_team_member() returns boolean language sql stable security definer as $$select exists(select 1 from public.team_members where user_id=auth.uid())$$;
 create function public.can_access_research_workspace() returns boolean language sql stable security definer as $$select auth.uid()='00000000-0000-0000-0000-000000000003'::uuid$$;
 create table public.topics(id uuid primary key,deleted_at timestamptz,analysis jsonb not null default '{}');
 create table public.news_items(id uuid primary key default gen_random_uuid(),canonical_url text unique,title text,source text,captured_by uuid,captured_via text,metadata jsonb,deleted_at timestamptz);
 create table public.topic_news(topic_id uuid references public.topics(id),news_id uuid references public.news_items(id),linked_by uuid,deleted_at timestamptz,deleted_by uuid,primary key(topic_id,news_id));
 insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
 insert into public.team_members values('00000000-0000-0000-0000-000000000001','editor','Editor'),('00000000-0000-0000-0000-000000000002','member','Reader'),('00000000-0000-0000-0000-000000000003','editor','Research editor');
 insert into public.topics(id,deleted_at) values('10000000-0000-0000-0000-000000000001',null),('10000000-0000-0000-0000-000000000002',null);
`)
for(const name of ['202611090001_research_sources.sql','202611090002_research_enrichment.sql','202611090003_research_product_enrichment.sql'])await db.exec(await fs.readFile('supabase/migrations/'+name,'utf8'))
const login=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)}
const editor='00000000-0000-0000-0000-000000000001',member='00000000-0000-0000-0000-000000000002',owner='00000000-0000-0000-0000-000000000003'
const topic='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002'
const source={id:'20000000-0000-0000-0000-000000000001',topic_id:topic,type:'podcast',url:'https://example.org/episode',title:'Podcast',description:'Notes',language:'zh'}
await login(editor)
const body='原文 abc '.repeat(12000)
await db.query('select public.save_research_source($1,$2,$3,$4)',[source,body,'full','restricted'])
assert.equal((await db.query('select body from public.research_source_contents')).rows[0].body,body)
await db.query('select public.save_research_source($1)',[{...source,id:undefined,topic_id:other}])
assert.equal((await db.query('select count(*)::int as n from public.research_sources')).rows[0].n,1)
await db.query('select public.unlink_research_source($1,$2)',[topic,source.id])
assert.equal((await db.query('select count(*)::int as n from public.research_topic_sources where unlinked_at is null')).rows[0].n,1)
assert.equal((await db.query('select count(*)::int as n from public.research_source_contents')).rows[0].n,1)
await login(member)
assert.equal((await db.query('select * from public.research_source_contents')).rows.length,0)
await assert.rejects(()=>db.query('select public.save_research_source($1)',[source]),/Editor access required/)
await login(editor)
await db.query('select public.save_research_source($1,$2,$3,$4,$5)',[source,'Updated original','excerpt','restricted',1])
await assert.rejects(()=>db.query('select public.save_research_source($1,$2,$3,$4,$5)',[source,'stale','excerpt','team',1]),/Source changed/)
await login(owner,'service_role')
const claim=async()=> (await db.query('select public.claim_research_source($1) as job',[owner])).rows[0].job
let job=await claim()
assert.equal((await db.query('select public.finish_research_source($1,$2,null,$3) as state',[job.job_id,owner,'input_changed'])).rows[0].state,'superseded')
job=await claim()
await db.query('select public.finish_research_source($1,$2,$3)',[job.job_id,owner,{english_title:'Title',summary:'Supported summary',key_points:[{text:'Supported point'}]}])
await login(member)
assert.equal((await db.query('select * from public.research_source_summaries')).rows.length,0)
await login(editor)
assert.equal((await db.query('select * from public.research_source_summaries')).rows.length,1)
assert.equal((await db.query('select count(*)::int as n from public.research_source_versions')).rows[0].n,2)
await db.query('select public.capture_research_news($1,$2,$3,$4)',['https://example.org/news','News','Publisher',topic])
await db.query('select public.capture_research_news($1,$2,$3,$4)',['https://example.org/news','Other title','Publisher',other])
await db.exec('reset role')
assert.equal((await db.query('select count(*)::int as n from public.news_items')).rows[0].n,1)
assert.equal((await db.query('select count(*)::int as n from public.topic_news')).rows[0].n,2)
await db.query("update public.research_jobs set status='running',attempts=3,lease_expires_at=now()-interval '1 minute' where source_id=$1 and source_version=2",[source.id])
await login(owner,'service_role')
assert.equal(await claim(),null)
assert.equal((await db.query('select status,error_code from public.research_jobs where source_id=$1 and source_version=2',[source.id])).rows[0].status,'blocked')
await db.exec('reset role')
const product={id:'sample',name:'Sample',url:'https://example.org/product'}
await db.query('update public.topics set analysis=$1 where id=$2',[{products:[product]},topic])
await db.query('update public.topics set analysis=$1 where id=$2',[{products:[product]},topic])
assert.equal((await db.query('select count(*)::int as n from public.research_product_enrichment')).rows[0].n,1)
await login(owner,'service_role')
const productJob=(await db.query('select public.claim_research_product($1) as job',[owner])).rows[0].job
await db.query('select public.finish_research_product($1,$2,$3)',[productJob.job_id,owner,{fields:{company:'Example'},evidence:[{field:'company',quote:'Example'}]}])
await db.exec('reset role')
assert.deepEqual((await db.query('select analysis from public.topics where id=$1',[topic])).rows[0].analysis.products,[product])
await db.query('update public.topics set analysis=$1 where id=$2',[{products:[{...product,name:'Renamed'}]},topic])
await login(owner,'service_role')
const changedJob=(await db.query('select public.claim_research_product($1) as job',[owner])).rows[0].job
await db.exec('reset role')
await db.query('update public.topics set analysis=$1 where id=$2',[{products:[]},topic])
await login(owner,'service_role')
assert.equal((await db.query('select public.finish_research_product($1,$2,$3) as status',[changedJob.job_id,owner,{fields:{company:'Example'},evidence:[]}])).rows[0].status,'superseded')
await db.exec('reset role')
await db.exec(await fs.readFile('supabase/migrations/202611130002_visitor_research_source.sql','utf8'))
await login('', 'anon')
await assert.rejects(()=>db.query('select public.visitor_research_source($1)',[{}]),/permission denied/)
await login('', 'service_role')
const visitorSource={topicId:topic,type:'podcast',url:'https://example.org/visitor',title:'Visitor podcast',language:'en',body:'Visitor original',scope:'excerpt'}
const visitorSaved=(await db.query('select public.visitor_research_source($1) as result',[visitorSource])).rows[0].result
assert.equal(visitorSaved.reused,false)
assert.equal((await db.query('select public.visitor_research_source($1) as result',[{...visitorSource,body:'Overwrite attempt'}])).rows[0].result.reused,true)
await db.exec('reset role')
assert.equal((await db.query('select created_by from research_sources where id=$1',[visitorSaved.id])).rows[0].created_by,null)
assert.equal((await db.query('select body from research_source_contents where source_id=$1',[visitorSaved.id])).rows[0].body,'Visitor original')
await db.close()
console.log('PASS: migrations, long transcript, reuse, unlink, restricted reads, role checks, stale edits, queue supersession, summary visibility, immutable history, and atomic news linking.')
