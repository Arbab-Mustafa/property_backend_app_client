-- Migration to add interest column to contact_submissions table
-- Run this if the table already exists without the interest column

ALTER TABLE contact_submissions 
ADD COLUMN IF NOT EXISTS interest TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'contact_submissions' 
AND column_name = 'interest'; 