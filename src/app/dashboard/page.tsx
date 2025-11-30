import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { ExpiringDocumentsWidget } from '@/components/dashboard/expiring-documents-widget';
import { PaymentBlocksWidget } from '@/components/dashboard/payment-blocks-widget';
import { RecentActivityWidget } from '@/components/dashboard/recent-activity-widget';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Dashboard'
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your contractor compliance status
        </p>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsSkeletons />}>
        <DashboardStats />
      </Suspense>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expiring Documents */}
        <Suspense fallback={<WidgetSkeleton title="Expiring Documents" />}>
          <ExpiringDocumentsWidget />
        </Suspense>

        {/* Payment Blocks */}
        <Suspense fallback={<WidgetSkeleton title="Payment Blocks" />}>
          <PaymentBlocksWidget />
        </Suspense>
      </div>

      {/* Recent Activity */}
      <Suspense fallback={<WidgetSkeleton title="Recent Activity" />}>
        <RecentActivityWidget />
      </Suspense>
    </div>
  );
}

function StatsSkeletons() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

function WidgetSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
