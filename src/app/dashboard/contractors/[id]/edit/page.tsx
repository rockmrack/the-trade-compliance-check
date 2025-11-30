'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Save, Building2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const UK_TRADE_TYPES = [
  { value: 'general_builder', label: 'General Builder' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'plumber', label: 'Plumber' },
  { value: 'gas_engineer', label: 'Gas Engineer' },
  { value: 'heating_engineer', label: 'Heating Engineer' },
  { value: 'carpenter', label: 'Carpenter / Joiner' },
  { value: 'roofer', label: 'Roofer' },
  { value: 'plasterer', label: 'Plasterer' },
  { value: 'painter_decorator', label: 'Painter & Decorator' },
  { value: 'bricklayer', label: 'Bricklayer' },
  { value: 'tiler', label: 'Tiler' },
  { value: 'flooring', label: 'Flooring Specialist' },
  { value: 'kitchen_fitter', label: 'Kitchen Fitter' },
  { value: 'bathroom_fitter', label: 'Bathroom Fitter' },
  { value: 'landscaper', label: 'Landscaper / Gardener' },
  { value: 'groundworker', label: 'Groundworker' },
  { value: 'scaffolder', label: 'Scaffolder' },
  { value: 'window_fitter', label: 'Window Fitter' },
  { value: 'locksmith', label: 'Locksmith' },
  { value: 'alarm_cctv', label: 'Alarm & CCTV Installer' },
  { value: 'damp_proofing', label: 'Damp Proofing Specialist' },
  { value: 'demolition', label: 'Demolition Contractor' },
  { value: 'drainage', label: 'Drainage Specialist' },
  { value: 'hvac', label: 'HVAC Engineer' },
  { value: 'solar_installer', label: 'Solar Panel Installer' },
  { value: 'ev_charger', label: 'EV Charger Installer' },
  { value: 'other', label: 'Other Trade' },
];

const contractorSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyNumber: z.string().optional(),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid UK phone number required'),
  tradeType: z.string().min(1, 'Trade type is required'),
  address: z.string().optional(),
  postcode: z.string().regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, 'Valid UK postcode required').optional().or(z.literal('')),
  vatNumber: z.string().regex(/^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$/i, 'Valid UK VAT number required').optional().or(z.literal('')),
  notes: z.string().optional(),
  verificationStatus: z.enum(['pending', 'verified', 'expired', 'blocked']),
  paymentStatus: z.enum(['allowed', 'blocked', 'on_hold']),
});

type ContractorFormData = z.infer<typeof contractorSchema>;

interface Contractor {
  id: string;
  company_name: string;
  company_number: string | null;
  contact_name: string;
  email: string;
  phone: string;
  trade_type: string;
  address: string | null;
  postcode: string | null;
  vat_number: string | null;
  notes: string | null;
  verification_status: 'pending' | 'verified' | 'expired' | 'blocked';
  payment_status: 'allowed' | 'blocked' | 'on_hold';
}

export default function EditContractorPage() {
  const router = useRouter();
  const params = useParams();
  const contractorId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [contractor, setContractor] = useState<Contractor | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm<ContractorFormData>({
    resolver: zodResolver(contractorSchema),
    defaultValues: {
      verificationStatus: 'pending',
      paymentStatus: 'blocked'
    }
  });

  const tradeType = watch('tradeType');
  const verificationStatus = watch('verificationStatus');
  const paymentStatus = watch('paymentStatus');

  useEffect(() => {
    const fetchContractor = async () => {
      try {
        const response = await fetch(`/api/contractors/${contractorId}`);
        const data = await response.json();

        if (data.success && data.data) {
          const c = data.data;
          setContractor(c);

          // Populate form
          setValue('companyName', c.company_name);
          setValue('companyNumber', c.company_number || '');
          setValue('contactName', c.contact_name);
          setValue('email', c.email);
          setValue('phone', c.phone);
          setValue('tradeType', c.trade_type);
          setValue('address', c.address || '');
          setValue('postcode', c.postcode || '');
          setValue('vatNumber', c.vat_number || '');
          setValue('notes', c.notes || '');
          setValue('verificationStatus', c.verification_status);
          setValue('paymentStatus', c.payment_status);
        } else {
          toast({
            title: 'Error',
            description: 'Contractor not found',
            variant: 'destructive'
          });
          router.push('/dashboard/contractors');
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to fetch contractor details',
          variant: 'destructive'
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchContractor();
  }, [contractorId, setValue, router]);

  const onSubmit = async (data: ContractorFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/contractors/${contractorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update contractor',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Contractor updated successfully'
      });

      router.push(`/dashboard/contractors/${contractorId}`);
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/contractors/${contractorId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Contractor</h1>
          <p className="text-muted-foreground">
            Update contractor details for {contractor?.company_name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Company Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Details
              </CardTitle>
              <CardDescription>
                Basic company information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  {...register('companyName')}
                  error={!!errors.companyName}
                />
                {errors.companyName && (
                  <p className="text-sm text-destructive">{errors.companyName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyNumber">Companies House Number</Label>
                <Input
                  id="companyNumber"
                  {...register('companyNumber')}
                  placeholder="e.g., 12345678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradeType">Trade Type *</Label>
                <Select
                  value={tradeType}
                  onValueChange={(value) => setValue('tradeType', value, { shouldDirty: true })}
                >
                  <SelectTrigger error={!!errors.tradeType}>
                    <SelectValue placeholder="Select trade type" />
                  </SelectTrigger>
                  <SelectContent>
                    {UK_TRADE_TYPES.map((trade) => (
                      <SelectItem key={trade.value} value={trade.value}>
                        {trade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.tradeType && (
                  <p className="text-sm text-destructive">{errors.tradeType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  {...register('vatNumber')}
                  placeholder="e.g., GB123456789"
                />
                {errors.vatNumber && (
                  <p className="text-sm text-destructive">{errors.vatNumber.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
              <CardDescription>
                Primary contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  {...register('contactName')}
                  error={!!errors.contactName}
                />
                {errors.contactName && (
                  <p className="text-sm text-destructive">{errors.contactName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  error={!!errors.email}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  placeholder="e.g., 07700 900000"
                  error={!!errors.phone}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  {...register('address')}
                  placeholder="Business address"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  {...register('postcode')}
                  placeholder="e.g., SW1A 1AA"
                  className="uppercase"
                  error={!!errors.postcode}
                />
                {errors.postcode && (
                  <p className="text-sm text-destructive">{errors.postcode.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Status Management
              </CardTitle>
              <CardDescription>
                Manage verification and payment status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verificationStatus">Verification Status</Label>
                <Select
                  value={verificationStatus}
                  onValueChange={(value) => setValue('verificationStatus', value as 'pending' | 'verified' | 'expired' | 'blocked', { shouldDirty: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(value) => setValue('paymentStatus', value as 'allowed' | 'blocked' | 'on_hold', { shouldDirty: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowed">Allowed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Blocking payments will prevent any invoices from being paid to this contractor.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>
                Additional information about this contractor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register('notes')}
                placeholder="Add any notes about this contractor..."
                rows={5}
              />
            </CardContent>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href={`/dashboard/contractors/${contractorId}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading || !isDirty}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
