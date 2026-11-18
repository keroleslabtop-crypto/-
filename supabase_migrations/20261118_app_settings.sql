create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value text
);

alter table public.app_settings enable row level security;
