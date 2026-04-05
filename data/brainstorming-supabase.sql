create extension if not exists pgcrypto;

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
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'brainstorming_entries'
          and policyname = 'brainstorming_entries_select'
    ) then
        create policy brainstorming_entries_select
            on public.brainstorming_entries
            for select
            to anon, authenticated
            using (true);
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'brainstorming_entries'
          and policyname = 'brainstorming_entries_insert'
    ) then
        create policy brainstorming_entries_insert
            on public.brainstorming_entries
            for insert
            to anon, authenticated
            with check (true);
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'brainstorming_entries'
          and policyname = 'brainstorming_entries_delete'
    ) then
        create policy brainstorming_entries_delete
            on public.brainstorming_entries
            for delete
            to anon, authenticated
            using (true);
    end if;
end
$$;

insert into storage.buckets (id, name, public)
select 'brainstorming-images', 'brainstorming-images', true
where not exists (
    select 1
    from storage.buckets
    where id = 'brainstorming-images'
);

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'brainstorming_images_select'
    ) then
        create policy brainstorming_images_select
            on storage.objects
            for select
            to anon, authenticated
            using (bucket_id = 'brainstorming-images');
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'brainstorming_images_insert'
    ) then
        create policy brainstorming_images_insert
            on storage.objects
            for insert
            to anon, authenticated
            with check (bucket_id = 'brainstorming-images');
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'brainstorming_images_delete'
    ) then
        create policy brainstorming_images_delete
            on storage.objects
            for delete
            to anon, authenticated
            using (bucket_id = 'brainstorming-images');
    end if;
end
$$;