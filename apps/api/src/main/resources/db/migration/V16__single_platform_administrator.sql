-- Platform Admin is an infrastructure singleton. The expression index makes
-- the invariant database-enforced, including concurrent or out-of-band writes.
CREATE UNIQUE INDEX platform_administrators_singleton_idx
  ON platform_administrators ((TRUE));
