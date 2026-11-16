// Full application SQL chain in isolated PostgreSQL. Supabase host facilities
// are stubbed; this does not validate hosted Auth/Realtime or production drift.
import fs from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite()
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_user::text$$;
 grant usage on schema auth to authenticated,service_role;
 create publication supabase_realtime;`)
 for(const file of (await fs.readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort()) {
  const sql=(await fs.readFile('supabase/migrations/'+file,'utf8')).replace(/create extension if not exists pgcrypto;/gi,'')
  try {await db.exec(sql)} catch(error){throw new Error(`${file}: ${error.message}`)}
 }
 await db.exec('set role service_role')
 const captured=await db.query("select public.visitor_write($1) as result",[{action:'capture',url:'https://example.org/full-chain',contributor:'Visitor'}])
 if(!captured.rows[0].result.id)throw new Error('Capture did not return an ID')
 console.log('PASS: complete application migration chain and visitor capture with real triggers (host auth/publication stubs).')
} finally {await db.close()}
