import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET() {
  const { userId } = auth();
  const supabase = getServiceClient();
  const query = supabase
    .from('debug_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25);

  if (userId) {
    query.eq('clerk_user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
