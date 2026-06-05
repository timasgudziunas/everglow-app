-- Profiles: one row per auth user, auto-created on signup
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamptz default now() not null
);

alter table profiles enable row level security;

create policy "users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create profile row when a user signs up
create function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Invite codes: short-lived codes used once to link two partners
create table invite_codes (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  expires_at timestamptz not null
);

alter table invite_codes enable row level security;

create policy "users can create own invite code"
  on invite_codes for insert
  with check (auth.uid() = user_id);

create policy "authenticated users can look up a code"
  on invite_codes for select
  using (auth.role() = 'authenticated');

create policy "users can delete own invite code"
  on invite_codes for delete
  using (auth.uid() = user_id);

-- Partner links: permanent bond between two accounts
create table partner_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  partner_id uuid references profiles(id) on delete cascade not null,
  linked_at timestamptz default now() not null,
  constraint no_self_link check (user_id <> partner_id),
  constraint unique_pair unique (user_id, partner_id)
);

alter table partner_links enable row level security;

create policy "users can read own partner links"
  on partner_links for select
  using (auth.uid() = user_id or auth.uid() = partner_id);