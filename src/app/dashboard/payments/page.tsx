'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  PlayCircle,
  RefreshCw
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

interface PaymentRunPreview {
  totalInvoices: number;
  canPayCount: number;
  blockedCount: number;
  totalAmount: number;
  approveableAmount: number;
  blockedAmount: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    contractorId: string;
    companyName: string;
    amount: number;
    dueDate: string;
    canPay: boolean;
    blockReason: string | null;
  }>;
}

export default function PaymentRunPage() {
  const queryClient = useQueryClient();

  const { data: preview, isLoading, refetch } = useQuery<PaymentRunPreview>({
    queryKey: ['payment-run-preview'],
    queryFn: async () => {
      const response = await fetch('/api/internal/payment-run');
      if (!response.ok) throw new Error('Failed to fetch preview');
      const result = await response.json();
      return result.data;
    }
  });

  const runPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/internal/payment-run', {
        method: 'POST'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Payment run failed');
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: 'Payment Run Complete',
        description: `Approved: ${result.data.approvedInvoices}, Blocked: ${result.data.blockedInvoices}`
      });
      queryClient.invalidateQueries({ queryKey: ['payment-run-preview'] });
    },
    onError: (error) => {
      toast({
        title: 'Payment Run Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Run</h1>
          <p className="text-muted-foreground">
            Review and process pending contractor payments
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => runPaymentMutation.mutate()}
            disabled={runPaymentMutation.isPending || !preview?.canPayCount}
          >
            {runPaymentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run Payment Check
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{preview?.totalInvoices || 0}</div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(preview?.totalAmount || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
              Ready to Pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {preview?.canPayCount || 0}
            </div>
            <p className="text-sm text-green-600 dark:text-green-500">
              {formatCurrency(preview?.approveableAmount || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
              Will Be Blocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {preview?.blockedCount || 0}
            </div>
            <p className="text-sm text-red-600 dark:text-red-500">
              {formatCurrency(preview?.blockedAmount || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invoices</CardTitle>
          <CardDescription>
            Review compliance status before running payment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview?.invoices && preview.invoices.length > 0 ? (
            <div className="space-y-4">
              {/* Approved Invoices */}
              {preview.invoices.filter((inv) => inv.canPay).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Ready to Pay ({preview.invoices.filter((inv) => inv.canPay).length})
                  </h3>
                  <div className="space-y-2">
                    {preview.invoices
                      .filter((inv) => inv.canPay)
                      .map((invoice) => (
                        <InvoiceRow key={invoice.id} invoice={invoice} />
                      ))}
                  </div>
                </div>
              )}

              {/* Blocked Invoices */}
              {preview.invoices.filter((inv) => !inv.canPay).length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Will Be Blocked ({preview.invoices.filter((inv) => !inv.canPay).length})
                  </h3>
                  <div className="space-y-2">
                    {preview.invoices
                      .filter((inv) => !inv.canPay)
                      .map((invoice) => (
                        <InvoiceRow key={invoice.id} invoice={invoice} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No pending invoices</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InvoiceRow({
  invoice
}: {
  invoice: {
    id: string;
    invoiceNumber: string;
    companyName: string;
    amount: number;
    dueDate: string;
    canPay: boolean;
    blockReason: string | null;
  };
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg ${
        invoice.canPay
          ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900'
          : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900'
      }`}
    >
      <div className="flex items-center gap-4">
        {invoice.canPay ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <div>
          <p className="font-medium">{invoice.companyName}</p>
          <p className="text-sm text-muted-foreground">
            Invoice #{invoice.invoiceNumber}
          </p>
          {!invoice.canPay && invoice.blockReason && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {invoice.blockReason}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold">{formatCurrency(invoice.amount)}</p>
        <p className="text-xs text-muted-foreground">
          Due {formatDate(invoice.dueDate)}
        </p>
      </div>
    </div>
  );
}
