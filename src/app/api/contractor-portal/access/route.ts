import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/services/email';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Email is required' } },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Find contractor by email
    const { data: contractor, error: fetchError } = await serviceClient
      .from('contractors')
      .select('id, company_name, contact_name, email')
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .single();

    if (fetchError || !contractor) {
      // Return success even if not found to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If this email exists in our system, an access link has been sent'
      });
    }

    // Generate access token
    const accessToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    // Store token in database
    await serviceClient.from('contractor_access_tokens').insert({
      contractor_id: contractor.id,
      token: accessToken,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    });

    // Build access link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const accessLink = `${baseUrl}/contractor/${accessToken}`;

    // Send email with access link
    try {
      await sendEmail({
        to: contractor.email,
        subject: 'Your Trade Compliance Portal Access Link',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #059669 0%, #0284c7 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Trade Compliance Engine</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <p style="font-size: 16px; color: #334155;">Hello ${contractor.contact_name},</p>
              <p style="font-size: 16px; color: #334155;">
                You requested access to your contractor compliance portal for <strong>${contractor.company_name}</strong>.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${accessLink}"
                   style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Access Your Portal
                </a>
              </div>
              <p style="font-size: 14px; color: #64748b;">
                This link will expire in 24 hours. If you didn't request this access, please ignore this email.
              </p>
              <p style="font-size: 14px; color: #64748b;">
                Or copy this link: <br>
                <a href="${accessLink}" style="color: #0284c7;">${accessLink}</a>
              </p>
            </div>
            <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8; font-size: 12px;">
              <p>Trade Compliance Engine - Ensuring contractor compliance across the UK</p>
            </div>
          </div>
        `,
        text: `Hello ${contractor.contact_name},

You requested access to your contractor compliance portal for ${contractor.company_name}.

Access your portal: ${accessLink}

This link will expire in 24 hours. If you didn't request this access, please ignore this email.

Trade Compliance Engine`
      });
    } catch (emailError) {
      console.error('Failed to send access email:', emailError);
      // Continue anyway - token is created
    }

    // Create audit log
    await serviceClient.from('audit_logs').insert({
      entity_type: 'contractor_access',
      entity_id: contractor.id,
      action: 'access_requested',
      new_values: {
        email: contractor.email,
        token_expires: expiresAt.toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'If this email exists in our system, an access link has been sent'
    });
  } catch (error) {
    console.error('Contractor portal access error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}
