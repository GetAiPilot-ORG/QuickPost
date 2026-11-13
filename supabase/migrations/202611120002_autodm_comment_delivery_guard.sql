create table public.autodm_comment_claims (
  comment_id text primary key check (length(comment_id) > 0),
  instagram_account_id uuid references public.instagram_accounts(id) on delete set null,
  automation_id uuid references public.automations(id) on delete set null,
  claimed_at timestamptz not null default now()
);
alter table public.autodm_comment_claims enable row level security;
revoke all on public.autodm_comment_claims from anon, authenticated;
grant select, insert on public.autodm_comment_claims to service_role;

insert into public.autodm_comment_claims (comment_id, claimed_at)
select event_id, min(created_at)
from public.webhook_logs
where event_type = 'comments' and nullif(event_id, '') is not null
 group by event_id
on conflict (comment_id) do nothing;
