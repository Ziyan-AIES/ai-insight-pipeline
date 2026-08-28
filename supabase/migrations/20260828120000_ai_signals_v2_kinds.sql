-- Split from v2: new enum values cannot be used in the same transaction.

alter type public.topic_kind add value if not exists 'pov';
alter type public.topic_kind add value if not exists 'strategy';
