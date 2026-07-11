ALTER TABLE "applications"
ADD COLUMN "identity_locked" BOOLEAN NOT NULL DEFAULT false;

-- Existing installations may already contain historical duplicates. They remain
-- editable so the administrator can resolve them without making this migration fail.
-- Every newly created or edited application is locked by these partial indexes.
CREATE UNIQUE INDEX "applications_locked_qq_number_key"
ON "applications"("qq_number")
WHERE "identity_locked" = true;

CREATE UNIQUE INDEX "applications_locked_minecraft_id_normalized_key"
ON "applications"("minecraft_id_normalized")
WHERE "identity_locked" = true;
