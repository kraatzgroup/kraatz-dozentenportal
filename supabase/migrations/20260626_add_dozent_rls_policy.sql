-- Allow dozenten with videobesprechung_dozent role to view all case study requests
CREATE POLICY "VB: Dozenten can view all case study requests"
ON vb_case_study_requests
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.additional_roles @> ARRAY['videobesprechung_dozent']::text[]
  )
);

-- Allow dozenten to update case study requests
CREATE POLICY "VB: Dozenten can update case study requests"
ON vb_case_study_requests
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.additional_roles @> ARRAY['videobesprechung_dozent']::text[]
  )
);
