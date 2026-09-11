-- Link native SocialPilot AutoDM contacts to GetAiPilot ecosystem contacts.

alter table public.contacts
  add column if not exists canonical_contact_id uuid,
  add column if not exists ecosystem_synced_at timestamptz,
  add column if not exists ecosystem_sync_source text,
  add column if not exists ecosystem_sync_status text not null default 'local'
    check (ecosystem_sync_status in ('local', 'synced', 'failed', 'skipped'));

create index if not exists idx_social_contacts_canonical_contact_id
  on public.contacts(canonical_contact_id)
  where canonical_contact_id is not null;

create unique index if not exists idx_social_contacts_account_canonical_unique
  on public.contacts(instagram_account_id, canonical_contact_id)
  where canonical_contact_id is not null;
