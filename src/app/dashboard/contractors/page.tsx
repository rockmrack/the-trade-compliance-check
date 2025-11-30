'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatTradeType, cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

export default function ContractorsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const supabase = createClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contractors', search, statusFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('contractors')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('company_name', { ascending: true })
        .range((page - 1) * limit, page * limit - 1);

      if (search) {
        query = query.ilike('company_name', `%${search}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('verification_status', statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { contractors: data, total: count || 0 };
    }
  });

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contractors</h1>
          <p className="text-muted-foreground">
            Manage your sub-contractors and their compliance status
          </p>
        </div>
        <Link href="/dashboard/contractors/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Contractor
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contractors..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="partially_verified">Partially Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contractors List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Contractors ({data?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : data?.contractors && data.contractors.length > 0 ? (
            <div className="space-y-4">
              {data.contractors.map((contractor) => (
                <ContractorRow key={contractor.id} contractor={contractor} />
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to{' '}
                    {Math.min(page * limit, data.total)} of {data.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No contractors found</p>
              <Link href="/dashboard/contractors/new">
                <Button variant="link">Add your first contractor</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContractorRow({
  contractor
}: {
  contractor: {
    id: string;
    company_name: string;
    trading_name: string | null;
    contact_name: string;
    email: string;
    phone: string;
    trade_types: string[];
    verification_status: string;
    payment_status: string;
    risk_score: number;
    created_at: string;
  };
}) {
  const statusConfig = {
    verified: {
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-100 dark:bg-green-900/30',
      label: 'Verified'
    },
    partially_verified: {
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      label: 'Partial'
    },
    unverified: {
      icon: AlertTriangle,
      color: 'text-gray-600',
      bg: 'bg-gray-100 dark:bg-gray-900/30',
      label: 'Unverified'
    },
    suspended: {
      icon: XCircle,
      color: 'text-orange-600',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      label: 'Suspended'
    },
    blocked: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-100 dark:bg-red-900/30',
      label: 'Blocked'
    }
  };

  const status = statusConfig[contractor.verification_status as keyof typeof statusConfig] || statusConfig.unverified;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={cn('p-2 rounded-lg', status.bg)}>
          <StatusIcon className={cn('h-5 w-5', status.color)} />
        </div>
        <div>
          <Link
            href={`/dashboard/contractors/${contractor.id}`}
            className="font-medium hover:underline"
          >
            {contractor.company_name}
          </Link>
          {contractor.trading_name && (
            <span className="text-sm text-muted-foreground ml-2">
              t/a {contractor.trading_name}
            </span>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">
              {contractor.contact_name}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {contractor.email}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {contractor.trade_types.slice(0, 3).map((trade) => (
              <Badge key={trade} variant="secondary" className="text-xs">
                {formatTradeType(trade)}
              </Badge>
            ))}
            {contractor.trade_types.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{contractor.trade_types.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <Badge
            variant={
              contractor.payment_status === 'allowed'
                ? 'success'
                : contractor.payment_status === 'blocked'
                ? 'danger'
                : 'warning'
            }
          >
            {contractor.payment_status === 'allowed'
              ? 'Payments OK'
              : contractor.payment_status === 'blocked'
              ? 'Blocked'
              : 'On Hold'}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">
            Risk: {contractor.risk_score}%
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/contractors/${contractor.id}`}>
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/contractors/${contractor.id}/edit`}>
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/contractors/${contractor.id}/documents`}>
                Documents
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
