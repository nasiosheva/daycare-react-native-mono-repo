CREATE OR REPLACE FUNCTION prevent_platform_administrator_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Platform administrator accounts cannot be deleted';
END;
$$;

CREATE TRIGGER platform_administrators_delete_protected
BEFORE DELETE ON platform_administrators
FOR EACH ROW EXECUTE FUNCTION prevent_platform_administrator_delete();
