create table if not exists public.inbox_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null,
  account_id text not null,
  account_name text,
  external_conversation_id text not null,
  thread_type text not null default 'direct_message'
    check (thread_type in ('direct_message', 'post_comment', 'mention')),
  external_post_id text,
  post_title text,
  post_thumbnail_url text,
  contact_external_id text,
  contact_name text,
  contact_handle text,
  contact_avatar_url text,
  last_message_text text,
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_read_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  is_replied boolean not null default false,
  is_starred boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, account_id, external_conversation_id)
);

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  platform text not null,
  account_id text not null,
  external_message_id text not null,
  sender_external_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null default '',
  message_type text not null default 'text',
  media_url text,
  delivery_status text not null default 'received',
  sent_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.inbox_sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null,
  account_id text not null,
  sync_cursor text,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, account_id)
);

create unique index if not exists inbox_messages_external_uidx
  on public.inbox_messages (user_id, platform, account_id, external_message_id);
create index if not exists inbox_conversations_feed_idx
  on public.inbox_conversations (user_id, last_message_at desc, id desc);
create index if not exists inbox_conversations_platform_feed_idx
  on public.inbox_conversations (user_id, platform, last_message_at desc, id desc);
create index if not exists inbox_messages_thread_idx
  on public.inbox_messages (conversation_id, sent_at desc, id desc);

alter table public.inbox_conversations enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.inbox_sync_state enable row level security;

drop policy if exists "own inbox conversations" on public.inbox_conversations;
create policy "own inbox conversations" on public.inbox_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own inbox messages" on public.inbox_messages;
create policy "own inbox messages" on public.inbox_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own inbox sync state" on public.inbox_sync_state;
create policy "own inbox sync state" on public.inbox_sync_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_unified_inbox_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_inbox_conversations on public.inbox_conversations;
create trigger touch_inbox_conversations before update on public.inbox_conversations
for each row execute function public.touch_unified_inbox_updated_at();
drop trigger if exists touch_inbox_sync_state on public.inbox_sync_state;
create trigger touch_inbox_sync_state before update on public.inbox_sync_state
for each row execute function public.touch_unified_inbox_updated_at();
