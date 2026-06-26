-- Create case-studies storage bucket for VB case study submissions
insert into storage.buckets (id, name, public)
values ('case-studies', 'case-studies', true)
on conflict (id) do nothing;

-- Grant public access to the bucket
create policy "Public Access"
on storage.objects for select
to public
using (bucket_id = 'case-studies');

-- Grant authenticated users upload access
create policy "Authenticated Upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'case-studies');

-- Grant authenticated users update access
create policy "Authenticated Update"
on storage.objects for update
to authenticated
with check (bucket_id = 'case-studies');

-- Grant authenticated users delete access
create policy "Authenticated Delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'case-studies');
