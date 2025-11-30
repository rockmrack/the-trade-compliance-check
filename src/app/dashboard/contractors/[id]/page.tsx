import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  FileCheck,
  CreditCard,
  Edit,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Shield
} from 'lucide-react';
import {
  formatDate,
  formatTradeType,
  formatDocumentType,
  formatCurrency,
  getDaysUntilExpiry,
  cn
} from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch contractor with documents
  const { data: contractor, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !contractor) {
    notFound();
  }

  // Fetch compliance documents
  const { data: documents } = await supabase
    .from('compliance_documents')
    .select('*')
    .eq('contractor_id', id)
    .is('replaced_by_id', null)
    .order('expiry_date', { ascending: true });

  // Fetch recent invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('contractor_id', id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch verification logs
  const { data: verificationLogs } = await supabase
    .from('verification_logs')
    .select('*')
    .eq('contractor_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  const statusConfig = {
    verified: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Verified' },
    partially_verified: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Partially Verified' },
    unverified: { icon: AlertTriangle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Unverified' },
    suspended: { icon: XCircle, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Suspended' },
    blocked: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Blocked' }
  };

  const status = statusConfig[contractor.verification_status as keyof typeof statusConfig] || statusConfig.unverified;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/contractors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {contractor.company_name}
              </h1>
              <Badge
                variant={
                  contractor.verification_status === 'verified'
                    ? 'success'
                    : contractor.verification_status === 'blocked'
                    ? 'danger'
                    : 'warning'
                }
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            {contractor.trading_name && (
              <p className="text-muted-foreground">
                Trading as: {contractor.trading_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/contractors/${id}/documents`}>
            <Button variant="outline">
              <FileCheck className="h-4 w-4 mr-2" />
              Documents
            </Button>
          </Link>
          <Link href={`/dashboard/contractors/${id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {contractor.company_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Companies House No.</p>
                  <p className="font-medium flex items-center gap-2">
                    {contractor.company_number}
                    <a
                      href={`https://find-and-update.company-information.service.gov.uk/company/${contractor.company_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              )}
              {contractor.vat_number && (
                <div>
                  <p className="text-sm text-muted-foreground">VAT Number</p>
                  <p className="font-medium">{contractor.vat_number}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Risk Score</p>
                <p className={cn(
                  'font-medium',
                  contractor.risk_score <= 25 ? 'text-green-600' :
                  contractor.risk_score <= 50 ? 'text-yellow-600' :
                  contractor.risk_score <= 75 ? 'text-orange-600' : 'text-red-600'
                )}>
                  {contractor.risk_score}% Risk
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Status</p>
                <Badge
                  variant={
                    contractor.payment_status === 'allowed' ? 'success' :
                    contractor.payment_status === 'blocked' ? 'danger' : 'warning'
                  }
                >
                  {contractor.payment_status === 'allowed' ? 'Payments Allowed' :
                   contractor.payment_status === 'blocked' ? 'Payments Blocked' : 'On Hold'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{contractor.contact_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${contractor.email}`} className="text-primary hover:underline">
                  {contractor.email}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${contractor.phone}`} className="text-primary hover:underline">
                  {contractor.phone}
                </a>
              </div>
              {contractor.address_line1 && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <address className="not-italic">
                    {contractor.address_line1}
                    {contractor.address_line2 && <>, {contractor.address_line2}</>}
                    <br />
                    {contractor.address_city}
                    {contractor.address_county && `, ${contractor.address_county}`}
                    <br />
                    {contractor.address_postcode}
                  </address>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trade Types */}
          <Card>
            <CardHeader>
              <CardTitle>Trade Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {contractor.trade_types.map((trade: string) => (
                  <Badge key={trade} variant="secondary">
                    {formatTradeType(trade)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compliance Documents */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Compliance Documents
                </CardTitle>
                <CardDescription>
                  Insurance certificates and certifications
                </CardDescription>
              </div>
              <Link href={`/dashboard/contractors/${id}/documents`}>
                <Button variant="outline" size="sm">
                  Manage Documents
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const daysLeft = getDaysUntilExpiry(doc.expiry_date);
                    const isExpired = daysLeft < 0;
                    const isExpiringSoon = daysLeft <= 30 && daysLeft >= 0;

                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border',
                          isExpired ? 'border-red-200 bg-red-50' :
                          isExpiringSoon ? 'border-yellow-200 bg-yellow-50' :
                          'border-green-200 bg-green-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {isExpired ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : isExpiringSoon ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          )}
                          <div>
                            <p className="font-medium">
                              {formatDocumentType(doc.document_type)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {doc.provider_name}
                              {doc.coverage_amount && ` • ${formatCurrency(doc.coverage_amount)}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={isExpired ? 'danger' : isExpiringSoon ? 'warning' : 'success'}
                          >
                            {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Valid'}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isExpired ? 'Expired' : 'Expires'} {formatDate(doc.expiry_date)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No documents uploaded</p>
                  <Link href={`/dashboard/contractors/${id}/documents`}>
                    <Button variant="link">Upload documents</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member Since</span>
                <span className="font-medium">
                  {contractor.onboarded_at
                    ? formatDate(contractor.onboarded_at)
                    : formatDate(contractor.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Verified</span>
                <span className="font-medium">
                  {contractor.last_verified_at
                    ? formatDate(contractor.last_verified_at)
                    : 'Never'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Documents</span>
                <span className="font-medium">{documents?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Invoices</span>
                <span className="font-medium">{invoices?.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Recent Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="font-medium">#{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(invoice.due_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(invoice.amount)}</p>
                        <Badge
                          variant={
                            invoice.status === 'paid' ? 'success' :
                            invoice.status === 'blocked' ? 'danger' :
                            invoice.status === 'approved' ? 'info' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No invoices yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Verification History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Verification History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {verificationLogs && verificationLogs.length > 0 ? (
                <div className="space-y-3">
                  {verificationLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">{log.check_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.status} • {formatDate(log.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No verification history
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {contractor.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{contractor.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
