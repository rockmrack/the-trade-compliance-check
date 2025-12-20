import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { generateWebhookSecret, WEBHOOK_EVENTS, WebhookEvent } from '@/lib/services/webhooks';
import { z } from 'zod';

const webhookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL required'),
  events: z.array(z.string()).min(1, 'At least one event required'),
  isActive: z.boolean().optional().default(true)
});

// GET - List webhooks
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const serviceClient = await createServiceClient();

    const { data: webhooks, error } = await serviceClient
      .from('webhooks')
      .select('id, name, url, events, is_active, last_triggered_at, last_response_code, failure_count, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Mask secrets in response
    const maskedWebhooks = webhooks?.map(w => ({
      ...(w as any),
      secretPreview: '••••••••' // Don't expose secrets
    }));

    return NextResponse.json({
      success: true,
      data: {
        webhooks: maskedWebhooks,
        availableEvents: WEBHOOK_EVENTS
      }
    });
  } catch (error) {
    console.error('Webhooks list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhooks' } },
      { status: 500 }
    );
  }
}

// POST - Create webhook
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = webhookSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validation.error.errors
          }
        },
        { status: 400 }
      );
    }

    const { name, url, events, isActive } = validation.data;

    // Validate events
    const validEvents = Object.keys(WEBHOOK_EVENTS);
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_EVENTS',
            message: `Invalid events: ${invalidEvents.join(', ')}`
          }
        },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Generate secret
    const secret = generateWebhookSecret();

    // Create webhook
    // @ts-ignore - Supabase type inference limitation
    const { data: webhook, error } = await serviceClient
      .from('webhooks')
      .insert({
        name,
        url,
        secret,
        events,
        is_active: isActive,
        created_by: user.id
      } as any)
      .select()
      .single();

    if (error) {
      throw error;
    }

        // Create audit log
    // @ts-ignore - Supabase type inference limitation
    await serviceClient.from('audit_logs').insert({
      entity_type: 'webhook',
      entity_id: (webhook as any).id,
      action: 'create',
      performed_by: user.id,
      new_values: {
        name,
        url,
        events
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: (webhook as any).id,
        name: (webhook as any).name,
        url: (webhook as any).url,
        events: (webhook as any).events,
        secret, // Only returned once at creation
        isActive: (webhook as any).is_active,
        message: 'Save your webhook secret - it will not be shown again'
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Webhook create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook' } },
      { status: 500 }
    );
  }
}
