'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  BarChart3,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  Loader2,
  TrendingUp,
  TrendingDown,
  Building2,
  FileWarning,
  PoundSterling
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface DashboardStats {
  totalContractors: number;
  verifiedContractors: number;
  pendingContractors: number;
  blockedContractors: number;
  totalDocuments: number;
  validDocuments: number;
  expiringDocuments: number;
  expiredDocuments: number;
  totalInvoicesValue: number;
  blockedInvoicesValue: number;
  complianceRate: number;
  documentsUploadedThisMonth: number;
}

interface ExpiringDocument {
  id: string;
  contractor_name: string;
  document_type: string;
  expiry_date: string;
  days_until_expiry: number;
}

interface RecentActivity {
  id: string;
  type: 'document_uploaded' | 'contractor_verified' | 'payment_blocked' | 'document_expired';
  description: string;
  timestamp: string;
}

const dateRanges = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'ytd', label: 'Year to date' },
];

export default function ReportsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expiringDocs, setExpiringDocs] = useState<ExpiringDocument[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/summary?range=${dateRange}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data.stats);
        setExpiringDocs(data.data.expiringDocuments || []);
        setRecentActivity(data.data.recentActivity || []);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load report data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = async (type: 'contractors' | 'documents' | 'compliance' | 'payments') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/reports/export?type=${type}&range=${dateRange}`);

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export Complete',
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} report downloaded`
      });
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Unable to generate report',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (pence: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(pence / 100);
  };

  const getDocumentTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      public_liability: 'Public Liability',
      employers_liability: "Employer's Liability",
      gas_safe: 'Gas Safe',
      niceic: 'NICEIC',
      napit: 'NAPIT',
      cscs: 'CSCS'
    };
    return types[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Compliance overview and export reports
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Contractors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalContractors || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{stats?.verifiedContractors || 0} verified</span>
              {' · '}
              <span className="text-amber-600">{stats?.pendingContractors || 0} pending</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.complianceRate?.toFixed(1) || 0}%
            </div>
            <div className="flex items-center text-xs">
              {(stats?.complianceRate || 0) >= 80 ? (
                <>
                  <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
                  <span className="text-green-600">Good standing</span>
                </>
              ) : (
                <>
                  <TrendingDown className="mr-1 h-3 w-3 text-amber-600" />
                  <span className="text-amber-600">Needs attention</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documents Expiring</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats?.expiringDocuments || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Within next 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blocked Payments</CardTitle>
            <PoundSterling className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats?.blockedInvoicesValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Due to compliance issues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Document Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Status Overview
          </CardTitle>
          <CardDescription>
            Current status of all compliance documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats?.validDocuments || 0}</p>
                <p className="text-sm text-green-700 dark:text-green-300">Valid</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats?.expiringDocuments || 0}</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">Expiring</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats?.expiredDocuments || 0}</p>
                <p className="text-sm text-red-700 dark:text-red-300">Expired</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <FileWarning className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalDocuments || 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expiring Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Documents Expiring Soon
            </CardTitle>
            <CardDescription>
              Documents expiring within 30 days requiring action
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expiringDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>No documents expiring soon</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expiringDocs.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{doc.contractor_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {getDocumentTypeLabel(doc.document_type)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        doc.days_until_expiry <= 7
                          ? 'border-red-500 text-red-500'
                          : 'border-amber-500 text-amber-500'
                      }
                    >
                      {doc.days_until_expiry} days
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Reports
            </CardTitle>
            <CardDescription>
              Download CSV reports for analysis and auditing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => exportReport('contractors')}
                disabled={isExporting}
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contractors Report
                </span>
                <Download className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => exportReport('documents')}
                disabled={isExporting}
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents Report
                </span>
                <Download className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => exportReport('compliance')}
                disabled={isExporting}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Compliance Summary
                </span>
                <Download className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => exportReport('payments')}
                disabled={isExporting}
              >
                <span className="flex items-center gap-2">
                  <PoundSterling className="h-4 w-4" />
                  Payments Report
                </span>
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {isExporting && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating report...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest compliance events and updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    activity.type === 'contractor_verified'
                      ? 'bg-green-100 text-green-600'
                      : activity.type === 'payment_blocked'
                      ? 'bg-red-100 text-red-600'
                      : activity.type === 'document_expired'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {activity.type === 'contractor_verified' && <CheckCircle2 className="h-4 w-4" />}
                    {activity.type === 'payment_blocked' && <XCircle className="h-4 w-4" />}
                    {activity.type === 'document_expired' && <AlertTriangle className="h-4 w-4" />}
                    {activity.type === 'document_uploaded' && <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.timestamp), "dd MMM yyyy 'at' HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
