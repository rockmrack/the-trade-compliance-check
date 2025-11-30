'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Loader2, Mail, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

const accessSchema = z.object({
  email: z.string().email('Valid email address required'),
});

type AccessInput = z.infer<typeof accessSchema>;

export default function ContractorPortalPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<AccessInput>({
    resolver: zodResolver(accessSchema)
  });

  const email = watch('email');

  const onSubmit = async (data: AccessInput) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/contractor-portal/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email })
      });

      const result = await response.json();

      if (!result.success) {
        toast({
          title: 'Access denied',
          description: result.error?.message || 'Email not found in our system',
          variant: 'destructive'
        });
        return;
      }

      setEmailSent(true);
      toast({
        title: 'Access link sent',
        description: 'Check your email for a secure access link'
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Unable to process your request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Mail className="h-7 w-7 text-green-600" />
              </div>
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent a secure access link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              The link will expire in 24 hours. Click it to access your contractor portal
              where you can view your compliance status and upload documents.
            </p>
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Didn&apos;t receive the email?
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEmailSent(false)}
              >
                Try a different email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Shield className="h-7 w-7 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Contractor Portal</CardTitle>
          <CardDescription>
            Access your compliance dashboard to view your status and upload documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Your registered email address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.co.uk"
                {...register('email')}
                error={!!errors.email}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending access link...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Request Access
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Not yet registered? Contact your principal contractor to get added to the system.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info boxes */}
      <div className="mt-8 grid gap-4">
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              What you can do here
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• View your current compliance status</li>
              <li>• Upload insurance certificates and qualifications</li>
              <li>• Track document expiry dates</li>
              <li>• Download verification badges</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
              Required UK documents
            </h3>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
              <li>• Public Liability Insurance (minimum £1m)</li>
              <li>• Employer&apos;s Liability Insurance (if applicable)</li>
              <li>• Trade certifications (Gas Safe, NICEIC, etc.)</li>
              <li>• CSCS Card (for construction sites)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
