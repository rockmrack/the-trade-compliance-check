'use client';

import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

interface ImportResult {
  row: number;
  success: boolean;
  companyName: string;
  contractorId?: string;
  error?: string;
}

interface ImportResponse {
  dryRun: boolean;
  totalRows: number;
  successCount: number;
  failCount: number;
  results: ImportResult[];
  hasMoreResults: boolean;
}

export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ImportResponse | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.csv')) {
      setFile(droppedFile);
      setResults(null);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please upload a CSV file',
        variant: 'destructive'
      });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.name.endsWith('.csv')) {
      setFile(selectedFile);
      setResults(null);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please upload a CSV file',
        variant: 'destructive'
      });
    }
  }, []);

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', isDryRun.toString());

      const response = await fetch('/api/import/contractors', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        toast({
          title: 'Import failed',
          description: data.error?.message || 'Unknown error',
          variant: 'destructive'
        });
        return;
      }

      setResults(data.data);

      if (data.data.dryRun) {
        toast({
          title: 'Validation complete',
          description: `${data.data.successCount} valid rows, ${data.data.failCount} with errors`
        });
      } else {
        toast({
          title: 'Import complete',
          description: `${data.data.successCount} contractors imported, ${data.data.failCount} failed`
        });
      }
    } catch {
      toast({
        title: 'Import failed',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    window.location.href = '/api/import/contractors';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Bulk Import</h1>
        <p className="text-muted-foreground">
          Import contractors from a CSV file
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Upload a CSV file containing contractor details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Download Template */}
            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>

            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                className="hidden"
                id="csv-upload"
                onChange={handleFileSelect}
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  {file ? file.name : 'Drop your CSV file here'}
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse
                </p>
              </label>
            </div>

            {file && (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setResults(null);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Import Options */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dryRun"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="dryRun" className="text-sm">
                  Validate only (dry run) - don&apos;t import yet
                </label>
              </div>
            </div>

            {/* Import Button */}
            <Button
              className="w-full"
              disabled={!file || isLoading}
              onClick={handleImport}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isDryRun ? 'Validating...' : 'Importing...'}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {isDryRun ? 'Validate CSV' : 'Import Contractors'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>CSV Format Requirements</CardTitle>
            <CardDescription>
              Ensure your CSV file meets UK compliance standards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Required Columns</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code>company_name</code> - Trading or registered name</li>
                  <li>• <code>contact_name</code> - Primary contact person</li>
                  <li>• <code>email</code> - Valid email address</li>
                  <li>• <code>phone</code> - UK phone number (07xxx or 01/02xxx)</li>
                  <li>• <code>trade_type</code> - e.g., plumber, electrician</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Optional Columns</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code>company_number</code> - Companies House number (8 digits)</li>
                  <li>• <code>address_line1</code>, <code>address_line2</code></li>
                  <li>• <code>address_city</code>, <code>address_county</code></li>
                  <li>• <code>address_postcode</code> - UK postcode format</li>
                  <li>• <code>vat_number</code> - UK VAT number (GB123456789)</li>
                  <li>• <code>notes</code> - Additional information</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Valid Trade Types</h4>
                <div className="flex flex-wrap gap-1">
                  {[
                    'plumber', 'electrician', 'gas_engineer', 'carpenter',
                    'roofer', 'plasterer', 'painter_decorator', 'general_builder'
                  ].map((trade) => (
                    <Badge key={trade} variant="outline" className="text-xs">
                      {trade}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">+ more</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {results.dryRun ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Validation Results
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Import Results
                </>
              )}
            </CardTitle>
            <CardDescription>
              {results.dryRun
                ? 'Review the validation results before importing'
                : 'Import completed successfully'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                <p className="text-2xl font-bold">{results.totalRows}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
                <p className="text-2xl font-bold text-green-600">{results.successCount}</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {results.dryRun ? 'Valid' : 'Imported'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
                <p className="text-2xl font-bold text-red-600">{results.failCount}</p>
                <p className="text-sm text-red-700 dark:text-red-300">Failed</p>
              </div>
            </div>

            {/* Proceed Button for Dry Run */}
            {results.dryRun && results.successCount > 0 && (
              <div className="mb-6">
                <Button
                  onClick={() => {
                    setIsDryRun(false);
                    handleImport();
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Proceed with Import ({results.successCount} contractors)
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Results Table */}
            {results.results.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-2 text-left">Row</th>
                      <th className="px-4 py-2 text-left">Company</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.results.map((result, index) => (
                      <tr key={index} className={result.success ? '' : 'bg-red-50 dark:bg-red-950/20'}>
                        <td className="px-4 py-2">{result.row}</td>
                        <td className="px-4 py-2 font-medium">{result.companyName}</td>
                        <td className="px-4 py-2">
                          {result.success ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {results.dryRun ? 'Valid' : 'Imported'}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              <XCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {result.error || (result.contractorId ? `ID: ${result.contractorId.substring(0, 8)}...` : '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.hasMoreResults && (
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 text-center text-sm text-muted-foreground">
                    Showing first 100 results only
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
