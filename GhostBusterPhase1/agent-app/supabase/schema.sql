create table if not exists public.debug_sessions (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text,
  screenshot_url text,
  audio_url text,
  dom_snapshot text,
  voice_summary text,
  bug_description text,
  affected_component text,
  root_cause text,
  suggested_diff text,
  severity text,
  confidence numeric,
  fix_summary text,
  last_tool_calls jsonb,
  created_at timestamptz default now()
);

create table if not exists public.app_files (
  file_path text primary key,
  content text not null,
  updated_at timestamptz default now()
);

alter table public.debug_sessions enable row level security;
alter table public.app_files enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'debug_sessions' and policyname = 'Allow read own'
  ) then
    create policy "Allow read own"
      on public.debug_sessions
      for select
      using (auth.uid() is null or clerk_user_id = auth.uid()::text);
  end if;
end $$;
