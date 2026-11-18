create table public.autodm_dm_activity (
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  sender_id text not null,
  last_inbound_at timestamptz not null,
  primary key (instagram_account_id, sender_id)
);

create table public.autodm_followups (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  user_id uuid not null,
  sender_id text not null,
  inbound_at timestamptz not null,
  scheduled_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '3 hours',
  status text not null default 'pending' check (status in ('pending','sending','sent','cancelled','failed')),
  attempts int not null default 0,
  usage_reserved boolean not null default false,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  unique (automation_id, instagram_account_id, sender_id)
);
create index autodm_followups_due on public.autodm_followups(due_at) where status = 'pending';
alter table public.autodm_dm_activity enable row level security;
alter table public.autodm_followups enable row level security;
revoke all on public.autodm_dm_activity from anon, authenticated;
revoke all on public.autodm_followups from anon, authenticated;
grant select on public.autodm_followups to authenticated;
grant all on public.autodm_dm_activity, public.autodm_followups to service_role;
create policy autodm_followups_owner_read on public.autodm_followups for select using (
  exists (select 1 from public.instagram_accounts a where a.id = autodm_followups.instagram_account_id and a.user_id = auth.uid())
);

create or replace function public.track_autodm_dm_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  event_time timestamptz;
  account_row record;
begin
  if nullif(new.sender_id, '') is null or new.sender_id = new.ig_id
     or new.event_type not in ('messages','messaging_postbacks')
     or coalesce(new.payload->'message'->>'is_echo','false') = 'true'
     or not (new.payload ? 'message' or new.payload ? 'postback') then return new; end if;
  -- Use the provider timestamp so delayed webhook delivery cannot reopen a window.
  if coalesce(new.payload->>'timestamp','') !~ '^[0-9]{10,16}$' then return new; end if;
  if (new.payload->>'timestamp')::numeric > extract(epoch from now() + interval '1 minute') * 1000 then return new; end if;
  event_time := to_timestamp((new.payload->>'timestamp')::numeric / 1000);
  event_time := least(event_time, now());
  for account_row in select id from public.instagram_accounts
    where instagram_user_id = new.ig_id or webhook_instagram_user_id = new.ig_id
  loop
    insert into public.autodm_dm_activity values (account_row.id, new.sender_id, event_time)
      on conflict (instagram_account_id, sender_id) do update
      set last_inbound_at = greatest(autodm_dm_activity.last_inbound_at, excluded.last_inbound_at);
    update public.autodm_followups set status = 'cancelled', last_error = 'recipient_replied'
      where instagram_account_id = account_row.id and sender_id = new.sender_id
      and status in ('pending','sending') and event_time > inbound_at;
  end loop;
  return new;
end $$;
create trigger track_autodm_dm_activity after insert on public.webhook_logs
for each row execute function public.track_autodm_dm_activity();

create or replace function public.schedule_autodm_followup(
  p_automation_id uuid, p_contact_id uuid, p_sender_id text, p_completed_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.autodm_followups (automation_id, instagram_account_id, contact_id, user_id, sender_id, inbound_at, scheduled_at, due_at)
  select a.id, a.instagram_account_id, p_contact_id, a.user_id, p_sender_id, d.last_inbound_at, p_completed_at, p_completed_at + interval '3 hours'
  from public.automations a
  join public.autodm_dm_activity d on d.instagram_account_id = a.instagram_account_id and d.sender_id = p_sender_id
  join public.contacts c on c.id = p_contact_id and c.instagram_account_id = a.instagram_account_id and c.instagram_user_id = p_sender_id
  where a.id = p_automation_id and a.is_active
    and a.response_flow->'follow_up'->>'enabled' = 'true'
    and length(trim(a.response_flow->'follow_up'->>'message')) > 0
    and d.last_inbound_at <= p_completed_at
    and d.last_inbound_at + interval '24 hours' > p_completed_at + interval '3 hours'
  on conflict (automation_id, instagram_account_id, sender_id) do nothing;
end $$;

create or replace function public.cancel_disabled_autodm_followups() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_active or coalesce(new.response_flow->'follow_up'->>'enabled', 'false') <> 'true' then
    update public.autodm_followups set status = 'cancelled', last_error = 'automation_disabled'
      where automation_id = new.id and status in ('pending','sending');
  end if;
  return new;
end $$;
create trigger cancel_disabled_autodm_followups after update of is_active, response_flow on public.automations
for each row execute function public.cancel_disabled_autodm_followups();
revoke all on function public.cancel_disabled_autodm_followups() from public, anon, authenticated;

create or replace function public.claim_autodm_followup() returns setof public.autodm_followups
language plpgsql security definer set search_path = public as $$
begin
  -- Never replay a send with an unknown outcome after a process crash.
  update public.autodm_followups set status = 'failed', last_error = 'delivery_outcome_unknown'
    where status = 'sending' and claimed_at < now() - interval '10 minutes';
  return query
  update public.autodm_followups f set status = 'sending', claimed_at = now(), attempts = attempts + 1
  where f.id = (select q.id from public.autodm_followups q where q.status = 'pending' and q.due_at <= now()
    order by q.due_at for update skip locked limit 1)
  returning f.*;
end $$;

revoke all on function public.track_autodm_dm_activity() from public, anon, authenticated;
revoke all on function public.schedule_autodm_followup(uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.claim_autodm_followup() from public, anon, authenticated;
grant execute on function public.schedule_autodm_followup(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.claim_autodm_followup() to service_role;
