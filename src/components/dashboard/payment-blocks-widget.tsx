import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ban, ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';

export async function PaymentBlocksWidget() {
  const supabase = await createClient();

  const { data: blockedPayments } = await supabase
    .from('payment_block_check')
    .select('*')
    .eq('can_pay', false)
    .not('block_reason', 'is', null)
    .order('due_date', { ascending: true })
    .limit(5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-red-600" />
          Blocked Payments
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/invoices?filter=blocked">
            View all
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {blockedPayments && blockedPayments.length > 0 ? (
          <div className="space-y-4">
            {blockedPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{payment.company_name}</p>
                    <Badge variant="danger">Blocked</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Invoice #{payment.invoice_number}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    {payment.block_reason}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold">
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(payment.due_date)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/dashboard/contractors/${payment.contractor_id}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Blocked</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(
                    blockedPayments.reduce((sum, p) => sum + p.amount, 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Ban className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No blocked payments</p>
            <p className="text-sm">All contractors are compliant</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
