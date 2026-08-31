/**
 * Shared upload constants.
 *
 * Used by both client-side validation and documented in the Supabase storage
 * migration that sets the matching `file_size_limit` on the relevant buckets.
 */

/** Maximum file size for document uploads in the correction process: 100 MB. */
export const MAX_DOCUMENT_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Human-readable label for the document upload size limit. */
export const MAX_DOCUMENT_UPLOAD_LABEL = '100MB';

/**
 * Returns true when the given file exceeds the document upload size limit.
 */
export function exceedsDocumentUploadLimit(file: { size: number }): boolean {
  return file.size > MAX_DOCUMENT_UPLOAD_BYTES;
}
