create extension if not exists pgcrypto;

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
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'vehicle_submissions'
          and policyname = 'vehicle_submissions_select'
    ) then
        create policy vehicle_submissions_select
            on public.vehicle_submissions
            for select
            to anon, authenticated
            using (true);
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'vehicle_submissions'
          and policyname = 'vehicle_submissions_insert'
    ) then
        create policy vehicle_submissions_insert
            on public.vehicle_submissions
            for insert
            to anon, authenticated
            with check (review_status = 'pending');
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'vehicle_submissions'
          and policyname = 'vehicle_submissions_update'
    ) then
        create policy vehicle_submissions_update
            on public.vehicle_submissions
            for update
            to anon, authenticated
            using (review_status = 'pending')
            with check (review_status in ('approved', 'rejected'));
    end if;

end
$$;

insert into storage.buckets (id, name, public)
select 'vehicle-submission-photos', 'vehicle-submission-photos', true
where not exists (
    select 1
    from storage.buckets
    where id = 'vehicle-submission-photos'
);

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'vehicle_submission_photos_select'
    ) then
        create policy vehicle_submission_photos_select
            on storage.objects
            for select
            to anon, authenticated
            using (bucket_id = 'vehicle-submission-photos');
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'vehicle_submission_photos_insert'
    ) then
        create policy vehicle_submission_photos_insert
            on storage.objects
            for insert
            to anon, authenticated
            with check (bucket_id = 'vehicle-submission-photos');
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'vehicle_submission_photos_delete'
    ) then
        create policy vehicle_submission_photos_delete
            on storage.objects
            for delete
            to anon, authenticated
            using (bucket_id = 'vehicle-submission-photos');
    end if;
end
$$;
