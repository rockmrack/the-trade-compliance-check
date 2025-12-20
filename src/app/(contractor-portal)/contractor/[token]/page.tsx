'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Upload,
  FileText,
  Building2,
  Calendar,
  Phone,
  Mail,
  ExternalLink,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow, format, parseISO, differenceInDays } from 'date-fns';

interface Document {
  id: string;
  document_type: string;
  provider_name: string;
  expiry_date: string;
  status: 'pending_review' | 'valid' | 'rejected' | 'expired' | 'fraud_suspected';
  verification_score: number;
  document_url: string;
  created_at: string;
}

interface Contractor {
  id: string;
  company_name: string;
  company_number: string | null;
  contact_name: string;
  email: string;
  phone: string;
  trade_type: string;
  verification_status: 'pending' | 'verified' | 'expired' | 'blocked';
  payment_status: 'allowed' | 'blocked' | 'on_hold';
  last_verified_at: string | null;
  compliance_documents: Document[];
}

const UK_DOCUMENT_TYPES = [
  { value: 'public_liability', label: 'Public Liability Insurance', required: true },
  { value: 'employers_liability', label: "Employer's Liability Insurance", required: true },
  { value: 'gas_safe', label: 'Gas Safe Registration', required: false },
  { value: 'niceic', label: 'NICEIC Certificate', required: false },
  { value: 'napit', label: 'NAPIT Certificate', required: false },
  { value: 'oftec', label: 'OFTEC Registration', required: false },
  { value: 'cscs', label: 'CSCS Card', required: false },
  { value: 'professional_indemnity', label: 'Professional Indemnity', required: false },
  { value: 'contractors_all_risk', label: "Contractor's All Risk", required: false },
  { value: 'waste_carrier', label: 'Waste Carrier Licence', required: false },
  { value: 'other', label: 'Other Document', required: false },
];

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', icon: Clock },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: AlertTriangle },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
};

const documentStatusConfig = {
  pending_review: { label: 'Pending Review', color: 'bg-amber-100 text-amber-800' },
  valid: { label: 'Verified', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-800' },
  fraud_suspected: { label: 'Under Review', color: 'bg-red-100 text-red-800' },
};

export default function ContractorDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchContractor = useCallback(async () => {
      try {
        const response = await fetch(`/api/contractor-portal/${token}`);
        const data = await response.json();

        if (!data.success) {
          toast({
            title: 'Access denied',
            description: 'Invalid or expired access link',
            variant: 'destructive'
          });
          router.push('/contractor');
          return;
        }

        setContractor(data.data);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load your details',
          variant: 'destructive'
        });
        router.push('/contractor');
      } finally {
        setIsLoading(false);
      }
    }, [token, router]);

  useEffect(() => {
    fetchContractor();
  }, [fetchContractor]);

  const handleFileUpload = async (documentType: string, file: File) => {
    if (!contractor) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contractorId', contractor.id);
      formData.append('documentType', documentType);
      formData.append('token', token);

      // Ask for expiry date
      const expiryDate = prompt('Enter document expiry date (YYYY-MM-DD):');
      if (!expiryDate) {
        toast({
          title: 'Upload cancelled',
          description: 'Expiry date is required',
          variant: 'destructive'
        });
        return;
      }
      formData.append('expiryDate', expiryDate);

      const response = await fetch('/api/contractor-portal/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        toast({
          title: 'Upload failed',
          description: result.error?.message || 'Failed to upload document',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Document uploaded',
        description: 'Your document has been submitted for verification'
      });

      // Refresh data
      fetchContractor();
    } catch {
      toast({
        title: 'Upload failed',
        description: 'An error occurred while uploading',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getDocumentLabel = (type: string) => {
    return UK_DOCUMENT_TYPES.find(d => d.value === type)?.label || type;
  };

  const getExpiryStatus = (expiryDate: string) => {
    const days = differenceInDays(parseISO(expiryDate), new Date());
    if (days < 0) return { label: 'Expired', color: 'text-red-600' };
    if (days <= 30) return { label: `Expires in ${days} days`, color: 'text-amber-600' };
    return { label: `Expires ${format(parseISO(expiryDate), 'dd MMM yyyy')}`, color: 'text-muted-foreground' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contractor) {
    return null;
  }

  const StatusIcon = statusConfig[contractor.verification_status].icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Status Banner */}
      <Card className={contractor.verification_status === 'verified' ? 'border-green-500' : 'border-amber-500'}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
              contractor.verification_status === 'verified'
                ? 'bg-green-100 dark:bg-green-900'
                : 'bg-amber-100 dark:bg-amber-900'
            }`}>
              <StatusIcon className={`h-8 w-8 ${
                contractor.verification_status === 'verified'
                  ? 'text-green-600'
                  : 'text-amber-600'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold">{contractor.company_name}</h2>
                <Badge className={statusConfig[contractor.verification_status].color}>
                  {statusConfig[contractor.verification_status].label}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {contractor.verification_status === 'verified'
                  ? 'Your compliance documents are up to date'
                  : 'Some documents need attention'
                }
              </p>
              {contractor.last_verified_at && (
                <p className="text-sm text-muted-foreground mt-1">
                  Last verified {formatDistanceToNow(parseISO(contractor.last_verified_at), { addSuffix: true })}
                </p>
              )}
            </div>
            {contractor.verification_status === 'verified' && (
              <Link href={`/verify?company=${contractor.company_number || contractor.id}`}>
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  View Public Profile
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{contractor.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{contractor.phone}</span>
            </div>
            {contractor.company_number && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>Companies House: {contractor.company_number}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{contractor.trade_type.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Status Warning */}
      {contractor.payment_status === 'blocked' && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <XCircle className="h-6 w-6 text-red-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100">
                  Payments Blocked
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                  Your payments are currently blocked due to incomplete or expired compliance documents.
                  Please upload the required documents below to restore payment status.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Compliance Documents
          </CardTitle>
          <CardDescription>
            Upload and manage your compliance certificates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {UK_DOCUMENT_TYPES.filter(d => d.required || contractor.compliance_documents.some(cd => cd.document_type === d.value)).map((docType) => {
              const document = contractor.compliance_documents.find(
                d => d.document_type === docType.value
              );

              return (
                <div
                  key={docType.value}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    document?.status === 'valid'
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      document?.status === 'valid'
                        ? 'bg-green-100 dark:bg-green-900'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}>
                      <FileText className={`h-5 w-5 ${
                        document?.status === 'valid'
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{docType.label}</span>
                        {docType.required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                        {document && (
                          <Badge className={documentStatusConfig[document.status].color}>
                            {documentStatusConfig[document.status].label}
                          </Badge>
                        )}
                      </div>
                      {document ? (
                        <div className="flex items-center gap-4 text-sm mt-1">
                          <span className={getExpiryStatus(document.expiry_date).color}>
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {getExpiryStatus(document.expiry_date).label}
                          </span>
                          {document.provider_name && (
                            <span className="text-muted-foreground">
                              Provider: {document.provider_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No document uploaded</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {document && (
                      <Link href={document.document_url} target="_blank">
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    <label>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(docType.value, file);
                          }
                        }}
                        disabled={isUploading}
                      />
                      <Button
                        variant={document ? 'outline' : 'default'}
                        size="sm"
                        className="cursor-pointer"
                        disabled={isUploading}
                        asChild
                      >
                        <span>
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              {document ? 'Replace' : 'Upload'}
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upload another type */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              Need to upload a different type of document?
            </p>
            <label>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const type = prompt('Select document type:\n' +
                      UK_DOCUMENT_TYPES.map((d, i) => `${i + 1}. ${d.label}`).join('\n')
                    );
                    if (type) {
                      const index = parseInt(type) - 1;
                      if (index >= 0 && index < UK_DOCUMENT_TYPES.length) {
                        const docType = UK_DOCUMENT_TYPES[index];
                        if (docType) {
                          handleFileUpload(docType.value, file);
                        }
                      }
                    }
                  }
                }}
                disabled={isUploading}
              />
              <Button variant="outline" className="cursor-pointer" disabled={isUploading} asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Other Document
                </span>
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Help */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Need help?
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
            If you have questions about your compliance requirements or need assistance
            uploading documents, please contact your principal contractor.
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Documents are verified using AI to check for authenticity, correct coverage amounts,
            and valid expiry dates. Verification typically takes a few minutes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
