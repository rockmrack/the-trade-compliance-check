import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profileData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const profile = profileData as any;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <DashboardHeader user={user} profile={profile} />
      <div className="flex">
        <DashboardNav userRole={profile?.role || 'viewer'} />
        <main className="flex-1 p-6 lg:p-8 lg:ml-64">{children}</main>
      </div>
    </div>
  );
}
