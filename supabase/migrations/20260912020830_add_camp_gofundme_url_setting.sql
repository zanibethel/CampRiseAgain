alter table public.camp_rise_again_site_settings
add column if not exists gofundme_url text not null default 'https://gofund.me/4e650f52a';

update public.camp_rise_again_site_settings
set gofundme_url = 'https://gofund.me/4e650f52a'
where id = 1 and coalesce(gofundme_url,'') = '';
