CREATE OR REPLACE FUNCTION public.recover_stale_broadcasts(p_stale_minutes integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_recovered_count integer;
BEGIN
  UPDATE public.broadcasts
  SET 
    status = 'scheduled',
    processing_started_at = NULL,
    last_error = 'Recovered from stale processing state',
    updated_at = NOW()
  WHERE 
    status = 'processing' 
    AND processing_started_at < NOW() - (p_stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS v_recovered_count = ROW_COUNT;
  
  RETURN v_recovered_count;
END;
$$;
