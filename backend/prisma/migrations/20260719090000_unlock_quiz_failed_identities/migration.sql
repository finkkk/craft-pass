-- Failed quiz attempts remain available for statistics and review, but must not
-- reserve a player's QQ number or Minecraft ID and prevent a retry.
UPDATE "applications"
SET "identity_locked" = false
WHERE "status" = 'quiz_failed';
