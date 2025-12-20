'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft,
  Upload,
  FileCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Trash2,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatDocumentType, formatCurrency, getDaysUntilExpiry, cn } from '@/lib/utils';

// UK-specific document types
const UK_DOCUMENT_TYPES = [
  { value: 'public_liability', label: 'Public Liability Insurance', required: true },
  { value: 'employers_liability', label: "Employer's Liability Insurance", required: true },
  { value: 'professional_indemnity', label: 'Professional Indemnity Insurance', required: false },
  { value: 'gas_safe', label: 'Gas Safe Registration', required: false },
  { value: 'niceic', label: 'NICEIC Certificate', required: false },
  { value: 'napit', label: 'NAPIT Certificate', required: false },
  { value: 'oftec', label: 'OFTEC Registration', required: false },
  { value: 'cscs', label: 'CSCS Card', required: false },
  { value: 'building_regulations', label: 'Building Regulations Approval', required: false },
  { value: 'other_certification', label: 'Other Certification', required: false }
];

// UK insurance providers
const UK_INSURANCE_PROVIDERS = [
  'Hiscox',
  'AXA',
  'Aviva',
  'Zurich',
  'Allianz',
  'RSA',
  'QBE',
  'Markel',
  'Tradesman Saver',
  'Simply Business',
  'Other'
];

export default function ContractorDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const contractorId = params.id as string;
  const supabase = createClient();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [providerName, setProviderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [coverageAmount, setCoverageAmount] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Fetch contractor
  const { data: contractor } = useQuery({
    queryKey: ['contractor', contractorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contractors')
        .select('*')
        .eq('id', contractorId)
        .single();
      if (error) throw error;
      return data as any;
    }
  });

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['contractor-documents', contractorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_documents')
        .select('*')
        .eq('contractor_id', contractorId)
        .is('replaced_by_id', null)
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return data as any[];
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0] || null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false
  });

  const handleUpload = async () => {
    if (!selectedFile || !documentType || !expiryDate) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('contractorId', contractorId);
      formData.append('documentType', documentType);
      formData.append('providerName', providerName || 'Unknown');
      formData.append('expiryDate', expiryDate);
      if (policyNumber) formData.append('policyNumber', policyNumber);
      if (coverageAmount) {
        // Convert GBP to pence
        const amountInPence = Math.round(parseFloat(coverageAmount) * 100);
        formData.append('coverageAmount', amountInPence.toString());
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Upload failed');
      }

      toast({
        title: 'Document Uploaded',
        description: result.data.message
      });

      // Reset form
      setSelectedFile(null);
      setDocumentType('');
      setProviderName('');
      setExpiryDate('');
      setPolicyNumber('');
      setCoverageAmount('');
      setUploadDialogOpen(false);

      // Refresh documents
      queryClient.invalidateQueries({ queryKey: ['contractor-documents', contractorId] });
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('compliance_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: 'Document Deleted',
        description: 'The document has been removed'
      });

      queryClient.invalidateQueries({ queryKey: ['contractor-documents', contractorId] });
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the document',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/contractors/${contractorId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Documents
            </h1>
            <p className="text-muted-foreground">
              {contractor?.company_name} - Compliance Documents
            </p>
          </div>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Compliance Document</DialogTitle>
              <DialogDescription>
                Upload an insurance certificate or certification document
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* File Drop Zone */}
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                )}
              >
                <input {...getInputProps()} />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileCheck className="h-8 w-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop a file here, or click to select
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, JPG, PNG up to 10MB
                    </p>
                  </>
                )}
              </div>

              {/* Document Type */}
              <div>
                <Label>Document Type *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {UK_DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                        {type.required && ' *'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Provider */}
              <div>
                <Label>Insurance Provider / Issuer</Label>
                <Select value={providerName} onValueChange={setProviderName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {UK_INSURANCE_PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Expiry Date */}
              <div>
                <Label>Expiry Date *</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Policy Number */}
              <div>
                <Label>Policy / Certificate Number</Label>
                <Input
                  placeholder="e.g. POL-12345678"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                />
              </div>

              {/* Coverage Amount */}
              {['public_liability', 'employers_liability', 'professional_indemnity'].includes(documentType) && (
                <div>
                  <Label>Coverage Amount (£)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 2000000"
                    value={coverageAmount}
                    onChange={(e) => setCoverageAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum: Public Liability £2M, Employers Liability £10M
                  </p>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={isUploading || !selectedFile || !documentType || !expiryDate}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading & Verifying...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Required Documents Notice */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileCheck className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Required Documents for UK Compliance
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 list-disc list-inside">
                <li>Public Liability Insurance (minimum £2,000,000)</li>
                <li>Employer's Liability Insurance (minimum £10,000,000)</li>
                <li>Gas Safe Registration (if gas work)</li>
                <li>NICEIC/NAPIT Certificate (if electrical work)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Uploaded Documents
          </CardTitle>
          <CardDescription>
            All compliance documents for this contractor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((doc) => {
                const daysLeft = getDaysUntilExpiry(doc.expiry_date);
                const isExpired = daysLeft < 0;
                const isExpiringSoon = daysLeft <= 30 && daysLeft >= 0;

                return (
                  <div
                    key={doc.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border',
                      isExpired
                        ? 'border-red-200 bg-red-50 dark:bg-red-950/20'
                        : isExpiringSoon
                        ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'
                        : 'border-green-200 bg-green-50 dark:bg-green-950/20'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {isExpired ? (
                        <XCircle className="h-8 w-8 text-red-600" />
                      ) : isExpiringSoon ? (
                        <AlertTriangle className="h-8 w-8 text-yellow-600" />
                      ) : (
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      )}
                      <div>
                        <p className="font-medium">
                          {formatDocumentType(doc.document_type)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {doc.provider_name}
                          {doc.policy_number && ` • ${doc.policy_number}`}
                        </p>
                        {doc.coverage_amount && (
                          <p className="text-sm text-muted-foreground">
                            Coverage: {formatCurrency(doc.coverage_amount)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={
                              doc.status === 'valid'
                                ? 'success'
                                : doc.status === 'expired'
                                ? 'danger'
                                : doc.status === 'expiring_soon'
                                ? 'warning'
                                : doc.status === 'fraud_suspected'
                                ? 'danger'
                                : 'secondary'
                            }
                          >
                            {doc.status.replace(/_/g, ' ')}
                          </Badge>
                          {doc.verification_score > 0 && (
                            <Badge variant="outline">
                              AI Score: {doc.verification_score}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <p className="text-sm font-medium">
                          {isExpired ? 'Expired' : 'Expires'} {formatDate(doc.expiry_date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isExpired
                            ? `${Math.abs(daysLeft)} days overdue`
                            : `${daysLeft} days remaining`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={doc.document_url} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDocument(doc.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No documents uploaded yet</p>
              <Button variant="link" onClick={() => setUploadDialogOpen(true)}>
                Upload your first document
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
