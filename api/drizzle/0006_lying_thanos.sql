-- Step 1: Add a new temporary column with the desired type
ALTER TABLE service_context ADD COLUMN extra_fields_jsonb jsonb[] DEFAULT '{}';

-- Step 2: Copy data from the old column to the new column
-- This assumes that each text entry is a JSON string that can be converted into a JSON object
UPDATE service_context
SET extra_fields_jsonb = ARRAY(
  SELECT jsonb_build_object('name', field, 'label', '') FROM unnest(extra_fields) AS field
);

-- Step 3: Drop the old column
ALTER TABLE service_context DROP COLUMN extra_fields;

-- Step 4: Rename the new column to the original column name
ALTER TABLE service_context RENAME COLUMN extra_fields_jsonb TO extra_fields;