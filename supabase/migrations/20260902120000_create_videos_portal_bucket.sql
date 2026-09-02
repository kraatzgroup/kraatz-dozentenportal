-- Create Videos-Portal storage bucket for public marketing/upsell videos
insert into storage.buckets (id, name, public)
values ('Videos-Portal', 'Videos-Portal', true)
on conflict (id) do nothing;

-- Grant public read access to the bucket
create policy "Public Access Videos-Portal"
on storage.objects for select
to public
using (bucket_id = 'Videos-Portal');

-- Grant authenticated users upload access
create policy "Authenticated Upload Videos-Portal"
on storage.objects for insert
to authenticated
with check (bucket_id = 'Videos-Portal');

-- Grant authenticated users update access
create policy "Authenticated Update Videos-Portal"
on storage.objects for update
to authenticated
with check (bucket_id = 'Videos-Portal');

-- Grant authenticated users delete access
create policy "Authenticated Delete Videos-Portal"
on storage.objects for delete
to authenticated
using (bucket_id = 'Videos-Portal');
