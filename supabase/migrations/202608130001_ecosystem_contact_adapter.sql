-- SocialPilot local mirror for GetAiPilot ecosystem contacts.
-- The existing contacts table is Instagram-specific, so shared leads live here.

create table if not exists public.ecosystem_contacts (
  id uuid primary key default gen_random_uuid(),
  canonical_contact_id uuid not null,
  user_id uuid references public.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  company text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  ecosystem_synced_at timestamptz,
  ecosystem_sync_source text,
  ecosystem_sync_status text not null default 'synced'
    check (ecosystem_sync_status in ('synced', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_contact_id)
);

create index if not exists idx_social_ecosystem_contacts_user
  on public.ecosystem_contacts(user_id, updated_at desc);

create index if not exists idx_social_ecosystem_contacts_phone
  on public.ecosystem_contacts(phone)
  where phone is not null;

create index if not exists idx_social_ecosystem_contacts_email
  on public.ecosystem_contacts(lower(email))
  where email is not null;

drop trigger if exists trg_ecosystem_contacts_updated_at on public.ecosystem_contacts;
create trigger trg_ecosystem_contacts_updated_at
before update on public.ecosystem_contacts
for each row execute function public.set_updated_at();

alter table public.ecosystem_contacts enable row level security;

drop policy if exists "Users can read own ecosystem contacts" on public.ecosystem_contacts;
create policy "Users can read own ecosystem contacts"
on public.ecosystem_contacts for select
using ((select auth.uid()) = user_id);
