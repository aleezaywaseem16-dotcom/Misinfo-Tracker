-- ============================================================
-- MisinfoTracker – complete schema (v3, idempotent)
-- Safe to re-run on an existing database.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- ROLES
-- ============================================================
create table if not exists roles (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique
);
insert into roles (name) values ('user'),('moderator'),('admin')
on conflict (name) do nothing;

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text not null unique,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);
alter table profiles add column if not exists bio        text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists role_id    uuid references roles(id);
alter table profiles add column if not exists updated_at timestamptz not null default now();

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  base_username text;
  candidate     text;
  suffix        int := 0;
begin
  base_username := coalesce(new.raw_user_meta_data->>'preferred_username', split_part(new.email,'@',1));
  candidate := base_username;

  -- the base username (derived from the email prefix) is not guaranteed unique
  -- across users, so probe for a free one instead of letting the insert below
  -- fail with a unique-violation that would roll back the whole signup.
  while exists (select 1 from profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into profiles (id, username, display_name, role_id)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'full_name', base_username),
    (select id from roles where name = 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- CATEGORIES
-- ============================================================
create table if not exists categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
alter table categories add column if not exists description text;
alter table categories add column if not exists color       text default '#6366f1';
alter table categories add column if not exists created_by  uuid references profiles(id) on delete set null;
alter table categories add column if not exists deleted_at  timestamptz;

insert into categories (name, description, color) values
  ('Health',       'Medical and health-related misinformation',  '#ef4444'),
  ('Politics',     'Political misinformation and propaganda',    '#f59e0b'),
  ('Science',      'Scientific misinformation',                  '#3b82f6'),
  ('Technology',   'Tech-related misinformation',                '#8b5cf6'),
  ('Economy',      'Economic misinformation',                    '#10b981'),
  ('Environment',  'Environmental and climate misinformation',   '#22c55e'),
  ('Social Media', 'Viral misinformation on social platforms',   '#ec4899'),
  ('Other',        'Miscellaneous misinformation',               '#6b7280')
on conflict (name) do nothing;

-- ============================================================
-- TAGS
-- ============================================================
create table if not exists tags (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
alter table tags add column if not exists created_by uuid references profiles(id) on delete set null;
alter table tags add column if not exists deleted_at timestamptz;

-- ============================================================
-- CLAIMS
-- ============================================================
create table if not exists claims (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  status     text not null default 'unverified',
  visibility text not null default 'public',
  created_at timestamptz not null default now()
);
alter table claims add column if not exists description         text;
alter table claims add column if not exists source_url          text;
alter table claims add column if not exists source_type         text default 'other';
alter table claims add column if not exists category_id         uuid references categories(id);
alter table claims add column if not exists estimated_origin_at timestamptz;
alter table claims add column if not exists deleted_at          timestamptz;
alter table claims add column if not exists updated_at          timestamptz not null default now();

-- legacy column rename (older deployments used "submitted_by"; app code expects "created_by")
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'claims' and column_name = 'submitted_by')
     and not exists (select 1 from information_schema.columns where table_name = 'claims' and column_name = 'created_by') then
    alter table claims rename column submitted_by to created_by;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'claims'::regclass and conname = 'claims_submitted_by_fkey')
     and not exists (select 1 from pg_constraint where conrelid = 'claims'::regclass and conname = 'claims_created_by_fkey') then
    alter table claims rename constraint claims_submitted_by_fkey to claims_created_by_fkey;
  end if;
end $$;
alter table claims add column if not exists created_by uuid references profiles(id) on delete set null;

create index if not exists claims_status_idx     on claims(status);
create index if not exists claims_visibility_idx on claims(visibility);
create index if not exists claims_category_idx   on claims(category_id);
create index if not exists claims_created_by_idx on claims(created_by);
create index if not exists claims_title_trgm_idx on claims using gin (title gin_trgm_ops);

-- ============================================================
-- CLAIM TAGS
-- ============================================================
create table if not exists claim_tags (
  claim_id uuid not null references claims(id) on delete cascade,
  tag_id   uuid not null references tags(id)   on delete cascade,
  primary key (claim_id, tag_id)
);
alter table claim_tags add column if not exists added_by  uuid references profiles(id) on delete set null;
alter table claim_tags add column if not exists created_at timestamptz not null default now();

-- ============================================================
-- PLATFORMS
-- ============================================================
create table if not exists platforms (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
alter table platforms add column if not exists slug      text;
alter table platforms add column if not exists icon_url  text;
alter table platforms add column if not exists base_url  text;
alter table platforms add column if not exists is_active boolean not null default true;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'platforms'::regclass and conname = 'platforms_slug_key'
  ) then
    -- backfill slug for any pre-existing rows before enforcing uniqueness
    update platforms set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) where slug is null;
    alter table platforms add constraint platforms_slug_key unique (slug);
  end if;
end $$;

insert into platforms (name, slug, base_url) values
  ('Twitter / X', 'x',         'https://x.com'),
  ('Facebook',    'facebook',  'https://facebook.com'),
  ('Instagram',   'instagram', 'https://instagram.com'),
  ('TikTok',      'tiktok',    'https://tiktok.com'),
  ('YouTube',     'youtube',   'https://youtube.com'),
  ('Reddit',      'reddit',    'https://reddit.com'),
  ('News article','news',      null),
  ('Other',       'other',     null)
on conflict (name) do nothing;

-- ============================================================
-- EVIDENCE
-- ============================================================
create table if not exists evidence (
  id         uuid primary key default uuid_generate_v4(),
  claim_id   uuid not null references claims(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);
alter table evidence alter column title drop not null;
alter table evidence add column if not exists description  text;
alter table evidence add column if not exists url          text;
alter table evidence add column if not exists type         text default 'link';
alter table evidence add column if not exists supports     boolean;
alter table evidence add column if not exists deleted_at   timestamptz;
alter table evidence add column if not exists updated_at   timestamptz not null default now();
alter table evidence add column if not exists content      text;
alter table evidence add column if not exists evidence_url text;
alter table evidence add column if not exists image_url    text;
alter table evidence add column if not exists platform_id  uuid references platforms(id) on delete set null;

do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'evidence' and column_name = 'submitted_by')
     and not exists (select 1 from information_schema.columns where table_name = 'evidence' and column_name = 'created_by') then
    alter table evidence rename column submitted_by to created_by;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'evidence'::regclass and conname = 'evidence_submitted_by_fkey')
     and not exists (select 1 from pg_constraint where conrelid = 'evidence'::regclass and conname = 'evidence_created_by_fkey') then
    alter table evidence rename constraint evidence_submitted_by_fkey to evidence_created_by_fkey;
  end if;
end $$;
alter table evidence add column if not exists created_by uuid references profiles(id) on delete set null;

create index if not exists evidence_claim_idx      on evidence(claim_id);
create index if not exists evidence_created_by_idx on evidence(created_by);
create index if not exists evidence_platform_idx   on evidence(platform_id);

-- ============================================================
-- COMMENTS
-- ============================================================
create table if not exists comments (
  id         uuid primary key default uuid_generate_v4(),
  claim_id   uuid not null references claims(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
alter table comments add column if not exists deleted_at timestamptz;
alter table comments add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'comments' and column_name = 'author_id')
     and not exists (select 1 from information_schema.columns where table_name = 'comments' and column_name = 'created_by') then
    alter table comments rename column author_id to created_by;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'comments'::regclass and conname = 'comments_author_id_fkey')
     and not exists (select 1 from pg_constraint where conrelid = 'comments'::regclass and conname = 'comments_created_by_fkey') then
    alter table comments rename constraint comments_author_id_fkey to comments_created_by_fkey;
  end if;
end $$;
alter table comments add column if not exists created_by uuid references profiles(id) on delete set null;

do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'comments' and column_name = 'parent_id')
     and not exists (select 1 from information_schema.columns where table_name = 'comments' and column_name = 'parent_comment_id') then
    alter table comments rename column parent_id to parent_comment_id;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'comments'::regclass and conname = 'comments_parent_id_fkey')
     and not exists (select 1 from pg_constraint where conrelid = 'comments'::regclass and conname = 'comments_parent_comment_id_fkey') then
    alter table comments rename constraint comments_parent_id_fkey to comments_parent_comment_id_fkey;
  end if;
end $$;
alter table comments add column if not exists parent_comment_id uuid references comments(id) on delete cascade;

create index if not exists comments_claim_idx     on comments(claim_id);
create index if not exists comments_created_by_idx on comments(created_by);
create index if not exists comments_parent_idx    on comments(parent_comment_id);

-- ============================================================
-- VOTES
-- ============================================================
create table if not exists claim_votes (
  id         uuid primary key default uuid_generate_v4(),
  claim_id   uuid not null references claims(id)   on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  vote_type  text not null,
  created_at timestamptz not null default now()
);
-- add unique constraint only if it doesn't already exist
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'claim_votes'::regclass and conname = 'claim_votes_claim_id_user_id_key'
  ) then
    alter table claim_votes add constraint claim_votes_claim_id_user_id_key unique (claim_id, user_id);
  end if;
end $$;

create index if not exists votes_claim_idx on claim_votes(claim_id);

-- ============================================================
-- USER WATCHLIST
-- ============================================================
create table if not exists user_watchlist (
  user_id    uuid not null references profiles(id) on delete cascade,
  claim_id   uuid not null references claims(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, claim_id)
);

create index if not exists watchlist_user_idx on user_watchlist(user_id);

-- ============================================================
-- USER CHAT HISTORY
-- ============================================================
create table if not exists user_chat_history (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  chat_session_id uuid not null,
  role            text not null,
  content         text not null,
  created_at      timestamptz not null default now()
);
alter table user_chat_history add column if not exists confidence  text;
alter table user_chat_history add column if not exists source_url  text;

create index if not exists chat_history_user_idx    on user_chat_history(user_id);
create index if not exists chat_history_session_idx on user_chat_history(chat_session_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
alter table profiles          enable row level security;
alter table categories        enable row level security;
alter table tags              enable row level security;
alter table claims            enable row level security;
alter table claim_tags        enable row level security;
alter table evidence          enable row level security;
alter table comments          enable row level security;
alter table claim_votes       enable row level security;
alter table user_watchlist    enable row level security;
alter table user_chat_history enable row level security;
alter table roles             enable row level security;

create or replace function current_user_role()
returns text language sql security definer stable as $$
  select r.name
  from profiles p
  join roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

-- ── roles ────────────────────────────────────────────────────
drop policy if exists "roles read" on roles;
create policy "roles read" on roles for select using (true);

-- ── profiles ─────────────────────────────────────────────────
drop policy if exists "profiles public read" on profiles;
drop policy if exists "profiles own update"  on profiles;
drop policy if exists "profiles admin all"   on profiles;
create policy "profiles public read" on profiles for select using (true);
create policy "profiles own update"  on profiles for update using (auth.uid() = id);
create policy "profiles admin all"   on profiles for all    using (current_user_role() = 'admin');

-- ── categories ───────────────────────────────────────────────
drop policy if exists "categories public read" on categories;
drop policy if exists "categories admin write" on categories;
create policy "categories public read" on categories for select using (true);
create policy "categories admin write" on categories for all    using (current_user_role() = 'admin');

-- ── tags ─────────────────────────────────────────────────────
drop policy if exists "tags public read"  on tags;
drop policy if exists "tags auth insert"  on tags;
drop policy if exists "tags admin delete" on tags;
create policy "tags public read"  on tags for select using (true);
create policy "tags auth insert"  on tags for insert with check (auth.uid() is not null);
create policy "tags admin delete" on tags for delete using (current_user_role() in ('admin','moderator'));

-- ── claims ───────────────────────────────────────────────────
drop policy if exists "claims public read" on claims;
drop policy if exists "claims own read"    on claims;
drop policy if exists "claims auth insert" on claims;
drop policy if exists "claims own update"  on claims;
drop policy if exists "claims mod delete"  on claims;
create policy "claims public read" on claims for select
  using (visibility = 'public' and deleted_at is null);
create policy "claims own read" on claims for select
  using (auth.uid() = created_by or current_user_role() in ('admin','moderator'));
create policy "claims auth insert" on claims for insert
  with check (auth.uid() is not null and created_by = auth.uid());
create policy "claims own update" on claims for update
  using (auth.uid() = created_by or current_user_role() in ('admin','moderator'));
create policy "claims mod delete" on claims for delete
  using (current_user_role() in ('admin','moderator'));

-- ── claim_tags ───────────────────────────────────────────────
drop policy if exists "claim tags public read" on claim_tags;
drop policy if exists "claim tags auth insert" on claim_tags;
drop policy if exists "claim tags auth delete" on claim_tags;
create policy "claim tags public read" on claim_tags for select using (true);
create policy "claim tags auth insert" on claim_tags for insert with check (auth.uid() is not null);
create policy "claim tags auth delete" on claim_tags for delete using (auth.uid() is not null);

-- ── evidence ─────────────────────────────────────────────────
drop policy if exists "evidence public read" on evidence;
drop policy if exists "evidence auth insert" on evidence;
drop policy if exists "evidence own update"  on evidence;
drop policy if exists "evidence mod delete"  on evidence;
create policy "evidence public read" on evidence for select using (deleted_at is null);
create policy "evidence auth insert" on evidence for insert
  with check (auth.uid() is not null and created_by = auth.uid());
create policy "evidence own update"  on evidence for update
  using (auth.uid() = created_by or current_user_role() in ('admin','moderator'));
create policy "evidence mod delete"  on evidence for delete
  using (current_user_role() in ('admin','moderator'));

-- ── comments ─────────────────────────────────────────────────
drop policy if exists "comments public read" on comments;
drop policy if exists "comments auth insert" on comments;
drop policy if exists "comments own update"  on comments;
drop policy if exists "comments mod delete"  on comments;
create policy "comments public read" on comments for select using (deleted_at is null);
create policy "comments auth insert" on comments for insert
  with check (auth.uid() is not null and created_by = auth.uid());
create policy "comments own update"  on comments for update
  using (auth.uid() = created_by or current_user_role() in ('admin','moderator'));
create policy "comments mod delete"  on comments for delete
  using (current_user_role() in ('admin','moderator'));

-- ── votes ────────────────────────────────────────────────────
drop policy if exists "votes public read" on claim_votes;
drop policy if exists "votes auth upsert" on claim_votes;
drop policy if exists "votes own delete"  on claim_votes;
create policy "votes public read" on claim_votes for select using (true);
create policy "votes auth upsert" on claim_votes for insert
  with check (auth.uid() is not null and user_id = auth.uid());
create policy "votes own delete"  on claim_votes for delete
  using (auth.uid() = user_id or current_user_role() in ('admin','moderator'));

-- ── user_watchlist ───────────────────────────────────────────
drop policy if exists "watchlist own read"   on user_watchlist;
drop policy if exists "watchlist own insert" on user_watchlist;
drop policy if exists "watchlist own update" on user_watchlist;
drop policy if exists "watchlist own delete" on user_watchlist;
create policy "watchlist own read"   on user_watchlist for select using (auth.uid() = user_id);
create policy "watchlist own insert" on user_watchlist for insert with check (auth.uid() = user_id);
create policy "watchlist own update" on user_watchlist for update using (auth.uid() = user_id);
create policy "watchlist own delete" on user_watchlist for delete using (auth.uid() = user_id);

-- ── user_chat_history ────────────────────────────────────────
drop policy if exists "chat history own read"   on user_chat_history;
drop policy if exists "chat history own insert" on user_chat_history;
drop policy if exists "chat history own delete" on user_chat_history;
create policy "chat history own read"   on user_chat_history for select using (auth.uid() = user_id);
create policy "chat history own insert" on user_chat_history for insert with check (auth.uid() = user_id);
create policy "chat history own delete" on user_chat_history for delete using (auth.uid() = user_id);

-- ============================================================
-- STORAGE — evidence images
-- ============================================================
insert into storage.buckets (id, name, public)
values ('evidence-images', 'evidence-images', true)
on conflict (id) do nothing;

drop policy if exists "evidence images public read" on storage.objects;
drop policy if exists "evidence images auth upload" on storage.objects;
drop policy if exists "evidence images own delete"  on storage.objects;
create policy "evidence images public read" on storage.objects for select
  using (bucket_id = 'evidence-images');
create policy "evidence images auth upload" on storage.objects for insert
  with check (bucket_id = 'evidence-images' and auth.uid() is not null);
create policy "evidence images own delete" on storage.objects for delete
  using (bucket_id = 'evidence-images' and owner = auth.uid());
