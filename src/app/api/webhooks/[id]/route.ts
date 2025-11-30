import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { generateWebhookSecret, WEBHOOK_EVENTS } from '@/lib/services/webhooks';
import { z } from 'zod';

const updateWebhookSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
  regenerateSecret: z.boolean().optional()
});

// GET - Get webhook details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const serviceClient = await createServiceClient();

    // Get webhook
    const { data: webhook, error } = await serviceClient
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !webhook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      );
    }

    // Get recent deliveries
    const { data: deliveries } = await serviceClient
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      data: {
        webhook: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.is_active,
          lastTriggeredAt: webhook.last_triggered_at,
          lastResponseCode: webhook.last_response_code,
          failureCount: webhook.failure_count,
          createdAt: webhook.created_at
        },
        deliveries: deliveries?.map(d => ({
          id: d.id,
          eventType: d.event_type,
          status: d.status,
          responseCode: d.response_code,
          durationMs: d.duration_ms,
          createdAt: d.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Webhook get error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhook' } },
      { status: 500 }
    );
  }
}

// PATCH - Update webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = updateWebhookSchema.safeParse(body);

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

    const { name, url, events, isActive, regenerateSecret } = validation.data;
    const serviceClient = await createServiceClient();

    // Validate events if provided
    if (events) {
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
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (events !== undefined) updateData.events = events;
    if (isActive !== undefined) updateData.is_active = isActive;

    let newSecret: string | undefined;
    if (regenerateSecret) {
      newSecret = generateWebhookSecret();
      updateData.secret = newSecret;
    }

    // Update webhook
    const { data: webhook, error } = await serviceClient
      .from('webhooks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !webhook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      );
    }

    // Create audit log
    await serviceClient.from('audit_logs').insert({
      entity_type: 'webhook',
      entity_id: id,
      action: 'update',
      performed_by: user.id,
      new_values: updateData
    });

    return NextResponse.json({
      success: true,
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.is_active,
        newSecret: newSecret,
        message: newSecret ? 'Secret regenerated - save it now' : 'Webhook updated'
      }
    });
  } catch (error) {
    console.error('Webhook update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update webhook' } },
      { status: 500 }
    );
  }
}

// DELETE - Delete webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const serviceClient = await createServiceClient();

    // Delete webhook
    const { error } = await serviceClient
      .from('webhooks')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Create audit log
    await serviceClient.from('audit_logs').insert({
      entity_type: 'webhook',
      entity_id: id,
      action: 'delete',
      performed_by: user.id
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    console.error('Webhook delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook' } },
      { status: 500 }
    );
  }
}
