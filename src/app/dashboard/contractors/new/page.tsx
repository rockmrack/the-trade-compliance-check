'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Building2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { createContractorSchema, type CreateContractorInput } from '@/lib/validations';
import { createClient } from '@/lib/supabase/client';

const UK_TRADE_TYPES = [
  { value: 'electrician', label: 'Electrician' },
  { value: 'plumber', label: 'Plumber' },
  { value: 'gas_engineer', label: 'Gas Engineer' },
  { value: 'roofer', label: 'Roofer' },
  { value: 'carpenter', label: 'Carpenter / Joiner' },
  { value: 'builder', label: 'Builder' },
  { value: 'plasterer', label: 'Plasterer' },
  { value: 'painter_decorator', label: 'Painter & Decorator' },
  { value: 'tiler', label: 'Tiler' },
  { value: 'landscaper', label: 'Landscaper' },
  { value: 'hvac', label: 'Heating Engineer' },
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'other', label: 'Other' }
];

export default function NewContractorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCompany, setIsSearchingCompany] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<CreateContractorInput>({
    resolver: zodResolver(createContractorSchema),
    defaultValues: {
      tradeTypes: []
    }
  });

  const companyNumber = watch('companyNumber');

  const searchCompaniesHouse = async () => {
    if (!companyNumber || companyNumber.length < 8) {
      toast({
        title: 'Invalid Company Number',
        description: 'Please enter a valid 8-digit company number',
        variant: 'destructive'
      });
      return;
    }

    setIsSearchingCompany(true);
    try {
      const response = await fetch(`/api/companies-house/lookup?number=${companyNumber}`);
      const result = await response.json();

      if (result.success && result.data) {
        setValue('companyName', result.data.companyName);
        if (result.data.registeredOfficeAddress) {
          setValue('addressLine1', result.data.registeredOfficeAddress.line1 || '');
          setValue('addressCity', result.data.registeredOfficeAddress.city || '');
          setValue('addressPostcode', result.data.registeredOfficeAddress.postcode || '');
        }
        toast({
          title: 'Company Found',
          description: `${result.data.companyName} - ${result.data.companyStatus}`
        });
      } else {
        toast({
          title: 'Company Not Found',
          description: 'Could not find company on Companies House',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: 'Could not search Companies House',
        variant: 'destructive'
      });
    } finally {
      setIsSearchingCompany(false);
    }
  };

  const onSubmit = async (data: CreateContractorInput) => {
    if (selectedTrades.length === 0) {
      toast({
        title: 'Trade Types Required',
        description: 'Please select at least one trade type',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Generate slug from company name
      const slug = data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

      // @ts-ignore - Supabase type inference limitation
      const { data: contractor, error } = await supabase
        .from('contractors')
        .insert({
          company_name: data.companyName,
          trading_name: data.tradingName || null,
          company_number: data.companyNumber || null,
          vat_number: data.vatNumber || null,
          contact_name: data.contactName,
          email: data.email,
          phone: data.phone,
          whatsapp_number: data.whatsappNumber || data.phone,
          trade_types: selectedTrades,
          address_line1: data.addressLine1 || null,
          address_line2: data.addressLine2 || null,
          address_city: data.addressCity || null,
          address_county: data.addressCounty || null,
          address_postcode: data.addressPostcode || null,
          address_country: 'United Kingdom',
          notes: data.notes || null,
          tags: data.tags || [],
          public_profile_slug: slug,
          verification_status: 'unverified',
          payment_status: 'pending_review',
          risk_score: 50,
          onboarded_at: new Date().toISOString()
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Contractor Added',
        description: `${data.companyName} has been added successfully`
      });

      router.push(`/dashboard/contractors/${(contractor as any).id}`);
    } catch (error) {
      console.error('Error creating contractor:', error);
      toast({
        title: 'Error',
        description: 'Failed to create contractor',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTrade = (trade: string) => {
    setSelectedTrades((prev) =>
      prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/contractors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Contractor</h1>
          <p className="text-muted-foreground">
            Register a new sub-contractor in the system
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Details
            </CardTitle>
            <CardDescription>
              Enter the company registration details. Search Companies House to auto-fill.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Companies House Lookup */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="companyNumber">Companies House Number</Label>
                <Input
                  id="companyNumber"
                  placeholder="e.g. 12345678"
                  maxLength={8}
                  {...register('companyNumber')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  8-digit company registration number (optional for sole traders)
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={searchCompaniesHouse}
                  disabled={isSearchingCompany}
                >
                  {isSearchingCompany ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2">Lookup</span>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="e.g. Smith Electrical Services Ltd"
                  {...register('companyName')}
                  error={!!errors.companyName}
                />
                {errors.companyName && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.companyName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="tradingName">Trading As (Optional)</Label>
                <Input
                  id="tradingName"
                  placeholder="e.g. Smith Electrics"
                  {...register('tradingName')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="vatNumber">VAT Number (Optional)</Label>
              <Input
                id="vatNumber"
                placeholder="e.g. GB123456789"
                {...register('vatNumber')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: GB followed by 9 digits
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Details */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
            <CardDescription>
              Primary contact for compliance communications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  placeholder="e.g. John Smith"
                  {...register('contactName')}
                  error={!!errors.contactName}
                />
                {errors.contactName && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.contactName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g. john@smithelectrics.co.uk"
                  {...register('email')}
                  error={!!errors.email}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  placeholder="e.g. 07700 900123"
                  {...register('phone')}
                  error={!!errors.phone}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.phone.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="whatsappNumber">WhatsApp Number (Optional)</Label>
                <Input
                  id="whatsappNumber"
                  placeholder="e.g. 07700 900123"
                  {...register('whatsappNumber')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For automated reminders. Defaults to phone number.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trade Types */}
        <Card>
          <CardHeader>
            <CardTitle>Trade Types *</CardTitle>
            <CardDescription>
              Select all trades this contractor is qualified to perform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {UK_TRADE_TYPES.map((trade) => (
                <div
                  key={trade.value}
                  className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTrades.includes(trade.value)
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => toggleTrade(trade.value)}
                >
                  <Checkbox
                    checked={selectedTrades.includes(trade.value)}
                    onCheckedChange={() => toggleTrade(trade.value)}
                  />
                  <Label className="cursor-pointer">{trade.label}</Label>
                </div>
              ))}
            </div>
            {selectedTrades.length === 0 && (
              <p className="text-sm text-destructive mt-2">
                Please select at least one trade type
              </p>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>Business Address</CardTitle>
            <CardDescription>
              Registered business address in the United Kingdom
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input
                id="addressLine1"
                placeholder="e.g. 123 High Street"
                {...register('addressLine1')}
              />
            </div>
            <div>
              <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
              <Input
                id="addressLine2"
                placeholder="e.g. Unit 5"
                {...register('addressLine2')}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="addressCity">City / Town</Label>
                <Input
                  id="addressCity"
                  placeholder="e.g. London"
                  {...register('addressCity')}
                />
              </div>
              <div>
                <Label htmlFor="addressCounty">County (Optional)</Label>
                <Input
                  id="addressCounty"
                  placeholder="e.g. Greater London"
                  {...register('addressCounty')}
                />
              </div>
              <div>
                <Label htmlFor="addressPostcode">Postcode</Label>
                <Input
                  id="addressPostcode"
                  placeholder="e.g. NW1 6XE"
                  {...register('addressPostcode')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
            <CardDescription>
              Internal notes about this contractor (not visible to them)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any relevant notes about this contractor..."
              {...register('notes')}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link href="/dashboard/contractors">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Contractor'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
