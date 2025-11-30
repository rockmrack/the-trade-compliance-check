'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, CheckCircle2, XCircle, AlertTriangle, Building2, Shield, FileCheck } from 'lucide-react';
import { publicVerifySchema, type PublicVerifyInput } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrencyCompact, formatDocumentType, formatTradeType } from '@/lib/utils';
import type { PublicVerificationResult } from '@/types';

export function VerificationSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PublicVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<PublicVerifyInput>({
    resolver: zodResolver(publicVerifySchema),
    defaultValues: {
      type: 'company_name'
    }
  });

  const onSubmit = async (data: PublicVerifyInput) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/public/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Verification failed');
      }

      const result = await response.json();
      setResult(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Search Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            {...register('query')}
            placeholder="Enter company name or registration number..."
            className="pl-12 pr-32 h-14 text-lg rounded-xl border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary"
            error={!!errors.query}
          />
          <Button
            type="submit"
            size="lg"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Verify'
            )}
          </Button>
        </div>
        {errors.query && (
          <p className="mt-2 text-sm text-red-500">{errors.query.message}</p>
        )}
      </form>

      {/* Results */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-8"
          >
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-8 space-y-6"
          >
            {result.found ? (
              <VerificationResultCard result={result} />
            ) : (
              <NotFoundCard />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VerificationResultCard({ result }: { result: PublicVerificationResult }) {
  const isVerified = result.verificationStatus === 'verified';
  const isPartiallyVerified = result.verificationStatus === 'partially_verified';

  return (
    <>
      {/* Main Status Card */}
      <Card
        className={`overflow-hidden ${
          isVerified
            ? 'border-green-200 dark:border-green-900'
            : isPartiallyVerified
            ? 'border-yellow-200 dark:border-yellow-900'
            : 'border-red-200 dark:border-red-900'
        }`}
      >
        <div
          className={`px-6 py-4 ${
            isVerified
              ? 'bg-green-50 dark:bg-green-950/30'
              : isPartiallyVerified
              ? 'bg-yellow-50 dark:bg-yellow-950/30'
              : 'bg-red-50 dark:bg-red-950/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isVerified ? (
                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full animate-pulse-success">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              ) : isPartiallyVerified ? (
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full animate-pulse-warning">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              ) : (
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full animate-pulse-danger">
                  <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {result.contractor?.companyName}
                </h2>
                {result.contractor?.tradingName && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Trading as: {result.contractor.tradingName}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant={
                isVerified ? 'success' : isPartiallyVerified ? 'warning' : 'danger'
              }
              className="text-sm px-3 py-1"
            >
              {isVerified
                ? 'Verified Partner'
                : isPartiallyVerified
                ? 'Partially Verified'
                : 'Not Verified'}
            </Badge>
          </div>
        </div>

        <CardContent className="pt-6">
          {/* Verification Score */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Verification Score</span>
              <span className="text-sm font-bold">{result.overallScore}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${result.overallScore}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  result.overallScore >= 80
                    ? 'bg-green-500'
                    : result.overallScore >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
            </div>
          </div>

          {/* Trade Types */}
          {result.contractor?.tradeTypes && result.contractor.tradeTypes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Trade Types</h3>
              <div className="flex flex-wrap gap-2">
                {result.contractor.tradeTypes.map((trade) => (
                  <Badge key={trade} variant="secondary">
                    {formatTradeType(trade)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Badges */}
          {result.badges && result.badges.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Verification Badges</h3>
              <div className="flex flex-wrap gap-2">
                {result.badges.map((badge) => (
                  <div
                    key={badge.type}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm"
                    title={badge.description}
                  >
                    <Shield className="h-4 w-4 text-green-600" />
                    {badge.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member Since */}
          {result.contractor?.memberSince && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Member since {formatDate(result.contractor.memberSince)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Documents Card */}
      {result.contractor?.documents && result.contractor.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Compliance Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.contractor.documents.map((doc, index) => (
                <DocumentRow key={index} doc={doc} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Companies House Card */}
      {result.companiesHouse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Companies House
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Company Number
                </p>
                <p className="font-medium">
                  {result.companiesHouse.companyNumber}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Status
                </p>
                <Badge
                  variant={
                    result.companiesHouse.isActive ? 'success' : 'danger'
                  }
                >
                  {result.companiesHouse.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Incorporated
                </p>
                <p className="font-medium">
                  {formatDate(result.companiesHouse.incorporatedDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Registered Address
                </p>
                <p className="font-medium text-sm">
                  {result.companiesHouse.registeredAddress}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-slate-500 dark:text-slate-500 text-center">
        {result.disclaimer}
      </p>
    </>
  );
}

function DocumentRow({
  doc
}: {
  doc: {
    type: string;
    status: string;
    coverageAmount?: number;
    expiryDate: string;
    providerName: string;
  };
}) {
  const isValid = doc.status === 'valid';
  const isExpiringSoon = doc.status === 'expiring_soon';
  const isExpired = doc.status === 'expired';

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <div className="flex items-center gap-3">
        {isValid ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : isExpiringSoon ? (
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <div>
          <p className="font-medium">{formatDocumentType(doc.type)}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {doc.providerName}
            {doc.coverageAmount && ` - ${formatCurrencyCompact(doc.coverageAmount)}`}
          </p>
        </div>
      </div>
      <div className="text-right">
        <Badge
          variant={isValid ? 'success' : isExpiringSoon ? 'warning' : 'danger'}
        >
          {isValid ? 'Valid' : isExpiringSoon ? 'Expiring Soon' : 'Expired'}
        </Badge>
        <p className="text-xs text-slate-500 mt-1">
          {isExpired ? 'Expired' : 'Expires'} {formatDate(doc.expiryDate)}
        </p>
      </div>
    </div>
  );
}

function NotFoundCard() {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="pt-6">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No Results Found
          </h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            We couldn't find a contractor matching your search. This could mean
            they haven't registered with our verification system yet.
          </p>
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Not finding a contractor doesn't mean they're untrustworthy
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Many legitimate contractors may not have registered with our
                  system. We recommend asking for proof of insurance and
                  certifications directly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
