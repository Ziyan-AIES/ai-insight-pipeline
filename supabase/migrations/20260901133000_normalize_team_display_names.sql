-- Keep one human-readable identity across profile, ownership, and contribution UI.

update public.team_members
set display_name = 'Ziyan'
where lower(email) = 'lizy76@lenovo.com'
   or lower(coalesce(display_name, '')) = 'lizy76';

update public.news_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{contributor_name}',
  to_jsonb('Ziyan'::text),
  true
)
where lower(coalesce(metadata ->> 'contributor_name', '')) = 'lizy76';

update public.news_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{legacy_user}',
  to_jsonb('Ziyan'::text),
  true
)
where lower(coalesce(metadata ->> 'legacy_user', '')) = 'lizy76';

update public.news_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{capture,contributor_name}',
  to_jsonb('Ziyan'::text),
  true
)
where lower(coalesce(metadata #>> '{capture,contributor_name}', '')) = 'lizy76';

update public.news_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{capture,legacy_user}',
  to_jsonb('Ziyan'::text),
  true
)
where lower(coalesce(metadata #>> '{capture,legacy_user}', '')) = 'lizy76';
