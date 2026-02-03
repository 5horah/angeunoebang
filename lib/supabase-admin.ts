import { createClient } from '@supabase/supabase-js';

/**
 * 서버 전용 Supabase 클라이언트 (Service Role).
 * RLS 우회, Storage 삭제 등 관리 작업용.
 * API 라우트·크론에서만 사용하고, 클라이언트에 노출하지 마세요.
 */
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, serviceRoleKey);
}
