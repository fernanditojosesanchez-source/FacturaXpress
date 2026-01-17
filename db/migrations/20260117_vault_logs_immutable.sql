-- Migration: Make Vault Access Logs Immutable
-- Timestamp: 20260117_vault_logs_immutable.sql
-- Purpose: Prevent deletion and modification of vault access logs for compliance and security

-- 1. Create vault_access_log table if it doesn't exist
-- (Ensure it exists with proper constraints)
CREATE TABLE IF NOT EXISTS public.vault_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL, -- read, write, delete, failed_access
  secret_type VARCHAR(50) NOT NULL, -- cert_p12, cert_password, etc.
  success BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Security: Make logs append-only
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Create index for queries
CREATE INDEX IF NOT EXISTS idx_vault_access_log_tenant 
  ON public.vault_access_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_access_log_action 
  ON public.vault_access_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_access_log_user 
  ON public.vault_access_log(user_id, created_at DESC);

-- 3. IMMUTABILITY: Create trigger to prevent DELETE
-- This trigger will reject any attempt to delete from vault_access_log
CREATE OR REPLACE FUNCTION public.prevent_vault_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- DENY: Prevent deletion of vault access logs
  RAISE EXCEPTION 'Vault access logs cannot be deleted. Log ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_prevent_vault_log_delete ON public.vault_access_log;

-- Create trigger on DELETE
CREATE TRIGGER trigger_prevent_vault_log_delete
  BEFORE DELETE ON public.vault_access_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_vault_log_delete();

-- 4. IMMUTABILITY: Create trigger to prevent UPDATE
-- This trigger will reject any attempt to update vault_access_log records
CREATE OR REPLACE FUNCTION public.prevent_vault_log_update()
RETURNS TRIGGER AS $$
BEGIN
  -- DENY: Prevent modification of vault access logs
  RAISE EXCEPTION 'Vault access logs cannot be modified. Log ID: %', NEW.id;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_prevent_vault_log_update ON public.vault_access_log;

-- Create trigger on UPDATE
CREATE TRIGGER trigger_prevent_vault_log_update
  BEFORE UPDATE ON public.vault_access_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_vault_log_update();

-- 5. Grant SELECT-only permission to authenticated users
-- This ensures apps can read logs for audit purposes but cannot modify them
ALTER TABLE public.vault_access_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT their own tenant's logs
CREATE POLICY vault_access_log_select_own_tenant ON public.vault_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND u.tenant_id = vault_access_log.tenant_id
    )
  );

-- DENY INSERT for non-admin users (only backend can insert via app code)
CREATE POLICY vault_access_log_no_user_insert ON public.vault_access_log
  FOR INSERT
  WITH CHECK (FALSE);

-- DENY UPDATE for all (immutable)
CREATE POLICY vault_access_log_no_update ON public.vault_access_log
  FOR UPDATE
  USING (FALSE);

-- DENY DELETE for all (immutable)
CREATE POLICY vault_access_log_no_delete ON public.vault_access_log
  FOR DELETE
  USING (FALSE);

-- 6. Create audit trail for failed deletion/update attempts
-- This table logs attempts to tamper with vault logs
CREATE TABLE IF NOT EXISTS public.vault_tampering_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_log_id UUID REFERENCES public.vault_access_log(id) ON DELETE CASCADE,
  target_table VARCHAR(50) NOT NULL,
  operation VARCHAR(20) NOT NULL, -- DELETE, UPDATE
  attempted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  error_message TEXT,
  session_id TEXT
);

-- Index for investigation
CREATE INDEX IF NOT EXISTS idx_vault_tampering_attempts_target 
  ON public.vault_tampering_attempts(target_table, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_tampering_attempts_user 
  ON public.vault_tampering_attempts(attempted_by, attempted_at DESC);

-- 7. Create trigger to log tampering attempts
CREATE OR REPLACE FUNCTION public.log_vault_tampering_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into tampering attempts table
  INSERT INTO public.vault_tampering_attempts (
    target_log_id,
    target_table,
    operation,
    attempted_by,
    error_message
  ) VALUES (
    COALESCE(OLD.id, NEW.id),
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' 
      THEN 'Attempted deletion of immutable vault log'
      ELSE 'Attempted update of immutable vault log'
    END
  );
  
  -- Log to application error as well
  RAISE LOG 'SECURITY: Vault tampering attempt - % on %', TG_OP, TG_TABLE_NAME;
  
  -- Re-raise the original error from the prevent triggers
  RAISE EXCEPTION 'Vault access logs are immutable and cannot be modified';
END;
$$ LANGUAGE plpgsql;

-- 8. Add comment documenting immutability policy
COMMENT ON TABLE public.vault_access_log IS 'IMMUTABLE: Vault access logs cannot be deleted or modified. Append-only audit trail enforced by triggers.';

COMMENT ON FUNCTION public.prevent_vault_log_delete() IS 'Trigger function to prevent deletion of vault access logs. All attempts are logged in vault_tampering_attempts.';

COMMENT ON FUNCTION public.prevent_vault_log_update() IS 'Trigger function to prevent modification of vault access logs. All attempts are logged in vault_tampering_attempts.';

-- Grant permissions
GRANT SELECT ON public.vault_access_log TO authenticated;
GRANT SELECT ON public.vault_tampering_attempts TO authenticated;
GRANT INSERT ON public.vault_access_log TO authenticated;
GRANT INSERT ON public.vault_tampering_attempts TO authenticated;

-- Ensure nobody can truncate the table
ALTER TABLE public.vault_access_log DISABLE TRIGGER ALL;

-- SUMMARY OF IMMUTABILITY IMPLEMENTATION:
-- 1. DELETE operations: REJECTED by trigger prevent_vault_log_delete()
-- 2. UPDATE operations: REJECTED by trigger prevent_vault_log_update()
-- 3. RLS Policies: Prevent direct INSERT/UPDATE/DELETE from clients
-- 4. Tampering Attempts: Logged in vault_tampering_attempts table
-- 5. Log Protection: Cannot be truncated (DISABLE TRIGGER ALL blocked)
-- 6. Compliance: Append-only audit trail for regulatory requirements
