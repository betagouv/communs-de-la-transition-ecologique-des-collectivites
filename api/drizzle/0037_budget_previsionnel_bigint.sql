DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projets' AND column_name = 'budget_previsionnel' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "projets" ALTER COLUMN "budget_previsionnel" SET DATA TYPE bigint;
  END IF;
END $$;
