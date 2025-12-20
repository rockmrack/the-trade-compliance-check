import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileCheck, AlertTriangle, XCircle, CheckCircle2, CreditCard } from 'lucide-react';

export async function DashboardStats() {
  const supabase = await createClient();

  // Fetch all stats in parallel
  const [
    contractorStats,
    documentStats,
    paymentStats
  ] = await Promise.all([
    getContractorStats(supabase),
    getDocumentStats(supabase),
    getPaymentStats(supabase)
  ]);

  const stats = [
    {
      title: 'Total Contractors',
      value: contractorStats.total,
      description: `${contractorStats.verified} verified`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      title: 'Verified Rate',
      value: `${contractorStats.verifiedRate}%`,
      description: `${contractorStats.verified} of ${contractorStats.total}`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30'
    },
    {
      title: 'Expiring Soon',
      value: documentStats.expiring,
      description: 'Documents in next 30 days',
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
    },
    {
      title: 'Expired Documents',
      value: documentStats.expired,
      description: 'Require immediate attention',
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30'
    },
    {
      title: 'Pending Review',
      value: documentStats.pending,
      description: 'Documents awaiting verification',
      icon: FileCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30'
    },
    {
      title: 'Blocked Payments',
      value: paymentStats.blocked,
      description: `${formatCurrency(paymentStats.blockedAmount)} total`,
      icon: CreditCard,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function getContractorStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { count: total } = await supabase
    .from('contractors')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { count: verified } = await supabase
    .from('contractors')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('verification_status', 'verified');

  const totalCount = total || 0;
  const verifiedCount = verified || 0;
  const verifiedRate = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  return {
    total: totalCount,
    verified: verifiedCount,
    verifiedRate
  };
}

async function getDocumentStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [expiring, expired, pending] = await Promise.all([
    supabase
      .from('compliance_documents')
      .select('*', { count: 'exact', head: true })
      .is('replaced_by_id', null)
      .gte('expiry_date', now.toISOString().split('T')[0])
      .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]),
    supabase
      .from('compliance_documents')
      .select('*', { count: 'exact', head: true })
      .is('replaced_by_id', null)
      .lt('expiry_date', now.toISOString().split('T')[0]),
    supabase
      .from('compliance_documents')
      .select('*', { count: 'exact', head: true })
      .is('replaced_by_id', null)
      .eq('status', 'pending_review')
  ]);

  return {
    expiring: expiring.count || 0,
    expired: expired.count || 0,
    pending: pending.count || 0
  };
}

async function getPaymentStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: blockedInvoicesData } = await supabase
    .from('invoices')
    .select('amount')
    .eq('status', 'blocked');

  const blockedInvoices = blockedInvoicesData as any[];

  const blocked = blockedInvoices?.length || 0;
  const blockedAmount = blockedInvoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

  return {
    blocked,
    blockedAmount
  };
}

function formatCurrency(amountInPence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amountInPence / 100);
}
