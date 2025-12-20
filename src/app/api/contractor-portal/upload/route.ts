import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyDocument } from '@/lib/services/ai-verifier';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const contractorId = formData.get('contractorId') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const token = formData.get('token') as string | null;
    const expiryDate = formData.get('expiryDate') as string | null;
    const providerName = formData.get('providerName') as string | null;

    // Validate required fields
    if (!file || !contractorId || !documentType || !token || !expiryDate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields'
          }
        },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Validate token
    const { data: accessToken, error: tokenError } = await serviceClient
      .from('contractor_access_tokens')
      .select('contractor_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !accessToken) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid access token' } },
        { status: 401 }
      );
    }

    // @ts-ignore - Supabase type inference limitation
    if (new Date(accessToken.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Access link has expired' } },
        { status: 401 }
      );
    }

    // @ts-ignore - Supabase type inference limitation
    if (accessToken.contractor_id !== contractorId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Token does not match contractor' } },
        { status: 403 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'File must be PDF, JPEG, PNG, or WebP'
          }
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File must be less than 10MB'
          }
        },
        { status: 400 }
      );
    }

    // Generate file hash
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    // Check for duplicates
    const { data: existingDoc } = await serviceClient
      .from('compliance_documents')
      .select('id')
      .eq('file_hash', fileHash)
      .eq('contractor_id', contractorId)
      .is('replaced_by_id', null)
      .single();

    if (existingDoc) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_DOCUMENT',
            message: 'This document has already been uploaded'
          }
        },
        { status: 409 }
      );
    }

    // Upload to storage
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const fileName = `${contractorId}/${documentType}/${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await serviceClient.storage
      .from('compliance-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: 'Failed to upload file'
          }
        },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = serviceClient.storage
      .from('compliance-documents')
      .getPublicUrl(fileName);

    // Run AI verification for images
    let aiAnalysis = null;
    let verificationScore = 50;
    let status: 'pending_review' | 'valid' | 'rejected' | 'fraud_suspected' = 'pending_review';
    let rejectionReason: string | null = null;

    if (process.env.OPENAI_API_KEY && file.type.startsWith('image/')) {
      try {
        const base64 = buffer.toString('base64');
        const verificationResult = await verifyDocument(base64, file.type, {
          documentType,
          requireMinimumCoverage: ['public_liability', 'employers_liability'].includes(documentType),
          checkForFraud: true
        });

        if (verificationResult.success && verificationResult.analysis) {
          aiAnalysis = verificationResult.analysis;
          verificationScore = Math.round(verificationResult.analysis.confidence * 100);

          if (verificationResult.isValid) {
            status = 'valid';
          } else if (verificationResult.analysis.fraudIndicators?.some(
            (f) => f.severity === 'high' || f.severity === 'critical'
          )) {
            status = 'fraud_suspected';
            rejectionReason = 'Document flagged for manual review';
          } else if (verificationResult.rejectionReasons.length > 0) {
            status = 'rejected';
            rejectionReason = verificationResult.rejectionReasons.join('; ');
          }
        }
      } catch (aiError) {
        console.error('AI verification error:', aiError);
      }
    }

    // Check for existing document to replace
    const { data: existingCurrentDoc } = await serviceClient
      .from('compliance_documents')
      .select('id')
      .eq('contractor_id', contractorId)
      .eq('document_type', documentType)
      .is('replaced_by_id', null)
      .single();

    // Create document record
    const { data: document, error: dbError } = await serviceClient
      .from('compliance_documents')
      // @ts-ignore - Supabase type inference limitation
      .insert({
        contractor_id: contractorId,
        document_type: documentType,
        provider_name: providerName || 'Unknown',
        expiry_date: expiryDate,
        document_url: urlData.publicUrl,
        document_path: fileName,
        file_size_bytes: file.size,
        mime_type: file.type,
        file_hash: fileHash,
        status,
        verification_score: verificationScore,
        ai_analysis: aiAnalysis,
        rejection_reason: rejectionReason,
        metadata: {
          originalFileName: file.name,
          uploadedVia: 'contractor_portal',
          uploadedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error('Database error:', dbError);
      await serviceClient.storage.from('compliance-documents').remove([fileName]);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to create document record'
          }
        },
        { status: 500 }
      );
    }

    // Update old document as replaced
    if (existingCurrentDoc) {
      await serviceClient
        .from('compliance_documents')
        // @ts-ignore - Supabase type inference limitation
        .update({ replaced_by_id: document.id })
        // @ts-ignore - Supabase type inference limitation
        .eq('id', existingCurrentDoc.id);
    }

    // Create verification log
    // @ts-ignore - Supabase type inference limitation
    await serviceClient.from('verification_logs').insert({
      contractor_id: contractorId,
      // @ts-ignore - Supabase type inference limitation
      document_id: document.id,
      check_type: 'ai_document_scan',
      status: aiAnalysis ? 'success' : 'pending',
      result: {
        passed: status === 'valid',
        message: status === 'valid'
          ? 'Document verified successfully'
          : rejectionReason || 'Pending manual review',
        uploadedVia: 'contractor_portal'
      }
    });

    // Update contractor verification status if all required docs are valid
    if (status === 'valid') {
      const { data: allDocs } = await serviceClient
        .from('compliance_documents')
        .select('document_type, status')
        .eq('contractor_id', contractorId)
        .is('replaced_by_id', null);

      const requiredTypes = ['public_liability'];
      const hasAllRequired = requiredTypes.every((type) =>
        // @ts-ignore - Supabase type inference limitation
        allDocs?.some((d) => d.document_type === type && d.status === 'valid')
      );

      if (hasAllRequired) {
        await serviceClient
          .from('contractors')
          // @ts-ignore - Supabase type inference limitation
          .update({
            verification_status: 'verified',
            payment_status: 'allowed',
            last_verified_at: new Date().toISOString()
          })
          .eq('id', contractorId);
      }
    }

    // Create audit log
    // @ts-ignore - Supabase type inference limitation
    await serviceClient.from('audit_logs').insert({
      entity_type: 'document',
      // @ts-ignore - Supabase type inference limitation
      entity_id: document.id,
      action: 'upload',
      new_values: {
        document_type: documentType,
        status,
        uploadedVia: 'contractor_portal'
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        // @ts-ignore - Supabase type inference limitation
        id: document.id,
        status,
        verificationScore,
        message:
          status === 'valid'
            ? 'Document verified successfully'
            : status === 'fraud_suspected'
            ? 'Document flagged for review'
            : status === 'rejected'
            ? `Document rejected: ${rejectionReason}`
            : 'Document uploaded - pending verification'
      }
    });
  } catch (error) {
    console.error('Contractor portal upload error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Upload failed' } },
      { status: 500 }
    );
  }
}
