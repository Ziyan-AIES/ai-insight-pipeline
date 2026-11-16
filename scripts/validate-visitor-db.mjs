import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite()
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create type public.news_category as enum ('ecosystem');
    create table topics(id uuid primary key,deleted_at timestamptz);
    create table news_items(id uuid primary key default gen_random_uuid(),canonical_url text unique,title text,source text,captured_via text,editorial_status text,metadata jsonb,deleted_at timestamptz);
    create table topic_news(topic_id uuid references topics,news_id uuid references news_items,deleted_at timestamptz,deleted_by uuid,primary key(topic_id,news_id));
    create table trends(id uuid primary key default gen_random_uuid(),title text,category news_category,observation text,initial_read text,discussion_question text,status text,display_order int default 1,created_at timestamptz default now(),updated_at timestamptz default now(),version int default 1,deleted_at timestamptz);
    create table trend_news(trend_id uuid references trends,news_id uuid references news_items,deleted_at timestamptz,deleted_by uuid,primary key(trend_id,news_id));
  `)
  await db.exec(await fs.readFile('supabase/migrations/202611130001_visitor_write.sql', 'utf8'))
  const call = async input => (await db.query('select public.visitor_write($1) as result', [input])).rows[0].result
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(() => call({ action: 'capture', url: 'https://example.org' }), /permission denied/)
    await db.exec('reset role')
  }
  await db.exec('set role service_role')
  const first = await call({ action: 'capture', url: 'https://example.org', contributor: 'Alice' })
  const second = await call({ action: 'capture', url: 'https://example.org', contributor: 'Bob' })
  assert.equal(first.id, second.id)
  assert.equal(second.contributorName, 'Alice')
  const trend = await call({ action: 'create_trend', title: 'Test', category: 'ecosystem' })
  await call({ action: 'link_trend_source', trendId: trend.id, newsId: first.id })
  await call({ action: 'unlink_trend_source', trendId: trend.id, newsId: first.id })
  await assert.rejects(() => call({ action: 'delete_trend', trendId: trend.id }), /Unsupported/)
  await db.exec('reset role')
  assert.equal((await db.query('select count(*)::int as n from news_items')).rows[0].n, 1)
  assert.ok((await db.query('select deleted_at from trend_news')).rows[0].deleted_at)
  await db.query('update news_items set deleted_at=now() where id=$1', [first.id])
  await db.exec('set role service_role')
  await assert.rejects(() => call({ action: 'capture', url: 'https://example.org' }), /Source unavailable/)
  console.log('PASS: visitor RPC grants, duplicate attribution, additive capture, relationship unlink, protected deletion, and removed-source handling.')
} finally { await db.close() }
