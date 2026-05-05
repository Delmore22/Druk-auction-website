-- ============================================================
-- Collectors-Alliance unified schema
-- Run this once in the Collectors-Alliance SQL editor
-- Migrated from: Ideas Project + Vehicle-submissions
-- ============================================================

create extension if not exists pgcrypto;

-- ── brainstorming_entries (from Ideas Project) ────────────────

create table if not exists public.brainstorming_entries (
    id uuid primary key default gen_random_uuid(),
    created_by text,
    note_text text not null check (length(btrim(note_text)) > 0),
    attachments jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.brainstorming_entries
    add column if not exists created_by text;

alter table public.brainstorming_entries enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'brainstorming_entries'
          and policyname = 'brainstorming_entries_select'
    ) then
        create policy brainstorming_entries_select
            on public.brainstorming_entries for select
            to anon, authenticated using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'brainstorming_entries'
          and policyname = 'brainstorming_entries_insert'
    ) then
        create policy brainstorming_entries_insert
            on public.brainstorming_entries for insert
            to anon, authenticated with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'brainstorming_entries'
          and policyname = 'brainstorming_entries_delete'
    ) then
        create policy brainstorming_entries_delete
            on public.brainstorming_entries for delete
            to anon, authenticated using (true);
    end if;
end
$$;

-- ── vehicle_submissions (from Vehicle-submissions) ────────────

create table if not exists public.vehicle_submissions (
    id uuid primary key default gen_random_uuid(),
    vin text,
    year text,
    make text,
    model text,
    seller_name text,
    seller_company text,
    seller_email text,
    status_label text not null default 'Submitted for Review',
    review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
    review_notes text,
    summary_label text,
    submitted_payload jsonb not null default '{}'::jsonb,
    submitted_at timestamptz not null default timezone('utc', now()),
    reviewed_at timestamptz
);

alter table public.vehicle_submissions enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'vehicle_submissions'
          and policyname = 'vehicle_submissions_select'
    ) then
        create policy vehicle_submissions_select
            on public.vehicle_submissions for select
            to anon, authenticated using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'vehicle_submissions'
          and policyname = 'vehicle_submissions_insert'
    ) then
        create policy vehicle_submissions_insert
            on public.vehicle_submissions for insert
            to anon, authenticated with check (review_status = 'pending');
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'vehicle_submissions'
          and policyname = 'vehicle_submissions_update'
    ) then
        create policy vehicle_submissions_update
            on public.vehicle_submissions for update
            to anon, authenticated
            using (review_status = 'pending')
            with check (review_status in ('approved', 'rejected'));
    end if;
end
$$;

-- ── inventory_vehicles (live inventory source of truth) ───────────────────

create table if not exists public.inventory_vehicles (
    id text primary key,
    vin text,
    year int,
    make text,
    model text,
    engine text,
    transmission text,
    body_style text,
    mileage text,
    condition text,
    description text,
    photo text,
    starting_bid numeric,
    current_bid numeric,
    reserve_price numeric,
    buy_now_price numeric,
    market_status text not null default 'Sale',
    inventory_status text not null default 'Active' check (inventory_status in ('Active', 'Pending', 'Sold')),
    listing_type text,
    time_remaining text,
    seller text,
    location text,
    pickup text,
    auction_start_at timestamptz,
    auction_end_at timestamptz,
    is_demo boolean not null default false,
    is_archived boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists inventory_vehicles_inventory_status_idx
    on public.inventory_vehicles (inventory_status);

create index if not exists inventory_vehicles_market_status_idx
    on public.inventory_vehicles (market_status);

create index if not exists inventory_vehicles_auction_start_idx
    on public.inventory_vehicles (auction_start_at desc);

create index if not exists inventory_vehicles_is_archived_idx
    on public.inventory_vehicles (is_archived);

alter table public.inventory_vehicles enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'inventory_vehicles'
          and policyname = 'inventory_vehicles_select'
    ) then
        create policy inventory_vehicles_select
            on public.inventory_vehicles for select
            to anon, authenticated using (is_archived = false);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'inventory_vehicles'
          and policyname = 'inventory_vehicles_insert'
    ) then
        create policy inventory_vehicles_insert
            on public.inventory_vehicles for insert
            to anon, authenticated with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'inventory_vehicles'
          and policyname = 'inventory_vehicles_update'
    ) then
        create policy inventory_vehicles_update
            on public.inventory_vehicles for update
            to anon, authenticated using (true) with check (true);
    end if;
end
$$;

-- ── access_codes ─────────────────────────────────────────────

create table if not exists public.access_codes (
    code text primary key,
    status text not null default 'active' check (status in ('active', 'used')),
    created_by text,
    created_by_email text,
    created_at timestamptz not null default timezone('utc', now()),
    redeemed_by text,
    redeemed_at timestamptz
);

alter table public.access_codes enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'access_codes'
          and policyname = 'access_codes_select'
    ) then
        create policy access_codes_select
            on public.access_codes for select
            to anon, authenticated using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'access_codes'
          and policyname = 'access_codes_insert'
    ) then
        create policy access_codes_insert
            on public.access_codes for insert
            to anon, authenticated with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'access_codes'
          and policyname = 'access_codes_update'
    ) then
        create policy access_codes_update
            on public.access_codes for update
            to anon, authenticated using (true) with check (true);
    end if;
end
$$;

-- ── users ─────────────────────────────────────────────────────

create table if not exists public.users (
    id text primary key,
    email text,
    display_name text,
    role text not null default 'member' check (role in ('member', 'dealer', 'admin')),
    access_code text,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.users enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'users'
          and policyname = 'users_select'
    ) then
        create policy users_select
            on public.users for select
            to anon, authenticated using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'users'
          and policyname = 'users_insert'
    ) then
        create policy users_insert
            on public.users for insert
            to anon, authenticated with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'users'
          and policyname = 'users_update'
    ) then
        create policy users_update
            on public.users for update
            to anon, authenticated using (true) with check (true);
    end if;
end
$$;

-- ── user_favorites ───────────────────────────────────────────

create table if not exists public.user_favorites (
    user_id text not null,
    vehicle_id text not null,
    added_at timestamptz not null default timezone('utc', now()),
    primary key (user_id, vehicle_id)
);

alter table public.user_favorites enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'user_favorites'
          and policyname = 'user_favorites_select'
    ) then
        create policy user_favorites_select
            on public.user_favorites for select
            to anon, authenticated using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'user_favorites'
          and policyname = 'user_favorites_insert'
    ) then
        create policy user_favorites_insert
            on public.user_favorites for insert
            to anon, authenticated with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'user_favorites'
          and policyname = 'user_favorites_delete'
    ) then
        create policy user_favorites_delete
            on public.user_favorites for delete
            to anon, authenticated using (true);
    end if;
end
$$;

-- ── Storage buckets ───────────────────────────────────────────

insert into storage.buckets (id, name, public)
select 'brainstorming-images', 'brainstorming-images', true
where not exists (select 1 from storage.buckets where id = 'brainstorming-images');

insert into storage.buckets (id, name, public)
select 'vehicle-submission-photos', 'vehicle-submission-photos', true
where not exists (select 1 from storage.buckets where id = 'vehicle-submission-photos');

do $$
begin
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'brainstorming_images_select') then
        create policy brainstorming_images_select on storage.objects for select to anon, authenticated using (bucket_id = 'brainstorming-images');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'brainstorming_images_insert') then
        create policy brainstorming_images_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'brainstorming-images');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'brainstorming_images_delete') then
        create policy brainstorming_images_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'brainstorming-images');
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vehicle_submission_photos_select') then
        create policy vehicle_submission_photos_select on storage.objects for select to anon, authenticated using (bucket_id = 'vehicle-submission-photos');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vehicle_submission_photos_insert') then
        create policy vehicle_submission_photos_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'vehicle-submission-photos');
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'vehicle_submission_photos_delete') then
        create policy vehicle_submission_photos_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'vehicle-submission-photos');
    end if;
end
$$;

-- ── users role constraint: expand to include dev roles ────────

alter table public.users drop constraint if exists users_role_check;
alter table public.users
    add constraint users_role_check
    check (role in ('member', 'dealer', 'admin', 'developer', 'dev', 'ceo'));

-- ── timesheet_tasks (dev-only shared task tracker) ────────────

-- Helper function: returns true if the calling user has a dev role.
-- Uses SECURITY DEFINER so the RLS policy can query the users table safely.
create or replace function public.current_user_is_dev()
returns boolean
language sql
security definer
stable
as $$
    select exists (
        select 1 from public.users
        where id = auth.uid()::text
          and role in ('admin', 'developer', 'dev', 'ceo')
    );
$$;

create table if not exists public.timesheet_tasks (
    id text primary key,
    title text not null check (length(btrim(title)) > 0),
    estimate_hours numeric,
    time_spent_hours numeric,
    comments text not null default '',
    status text not null default 'Not Started'
        check (status in ('Not Started', 'In Development', 'Ready for Approval', 'Completed')),
    updated_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.timesheet_tasks enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'timesheet_tasks'
          and policyname = 'timesheet_tasks_select'
    ) then
        create policy timesheet_tasks_select
            on public.timesheet_tasks for select
            to authenticated
            using (public.current_user_is_dev());
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'timesheet_tasks'
          and policyname = 'timesheet_tasks_insert'
    ) then
        create policy timesheet_tasks_insert
            on public.timesheet_tasks for insert
            to authenticated
            with check (public.current_user_is_dev());
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'timesheet_tasks'
          and policyname = 'timesheet_tasks_update'
    ) then
        create policy timesheet_tasks_update
            on public.timesheet_tasks for update
            to authenticated
            using (public.current_user_is_dev())
            with check (public.current_user_is_dev());
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'timesheet_tasks'
          and policyname = 'timesheet_tasks_delete'
    ) then
        create policy timesheet_tasks_delete
            on public.timesheet_tasks for delete
            to authenticated
            using (public.current_user_is_dev());
    end if;
end
$$;
