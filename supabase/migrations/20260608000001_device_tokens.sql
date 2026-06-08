-- Device tokens: one push token per user. Used to send a silent APNs push that
-- wakes the partner's app in the background so the beat relay survives the app
-- being suspended by iOS. Written/read only by the service-role backend
-- (relay + device-token routes), so no client-facing RLS policies are defined.
create table device_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  token text not null,
  platform text not null default 'ios',
  updated_at timestamptz default now() not null
);

-- One token per user — the upsert in POST /api/device-token relies on this for
-- its ON CONFLICT (user_id) target.
create unique index device_tokens_user_id_key on device_tokens (user_id);

alter table device_tokens enable row level security;
