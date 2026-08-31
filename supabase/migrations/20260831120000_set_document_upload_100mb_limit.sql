-- Set file_size_limit to 100MB for buckets used in the correction process.
-- Participants and instructors upload documents (klausuren, korrekturen,
-- case studies, materials) to these buckets. The previous limits were too
-- low for larger documents, causing uploads to fail.
--
-- 100 MB = 100 * 1024 * 1024 = 104857600 bytes

UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id IN ('elite-kleingruppe', 'masterclass', 'case-studies');
