alter table public.posts
  add column if not exists author_id uuid references auth.users(id) on delete set null,
  add column if not exists creator text,
  add column if not exists creator_avatar_url text,
  add column if not exists media_urls text[] not null default '{}',
  add column if not exists media_type text,
  add column if not exists publication_key text;

create unique index if not exists posts_socialpilot_publication_key
  on public.posts (author_id, publication_key)
  where source_platform = 'socialpilot';

create index if not exists posts_socialpilot_author_idx
  on public.posts (author_id, published_at desc)
  where source_platform = 'socialpilot';
