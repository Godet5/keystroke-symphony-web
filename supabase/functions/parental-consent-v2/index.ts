// Supabase Edge Function: Parental Consent v2 (Enhanced)
// Purpose: COPPA-compliant parental consent with rate limiting and validation
// Created: 2025-11-25

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { nanoid } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";

// ======================
// CONFIGURATION
// ======================

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SITE_URL = Deno.env.get("SITE_URL") || "https://yourdomain.com";
const EMAIL_SENDER = Deno.env.get("EMAIL_SENDER") || "no-reply@yourdomain.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// ======================
// VALIDATION SCHEMAS
// ======================

const ConsentRequestSchema = z.object({
  child_id: z.string().uuid("Invalid child ID"),
  parent_email: z.string().email("Invalid email address"),
  child_birthdate: z.string().optional(), // For verification
});

// ======================
// CORS HEADERS
// ======================

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ======================
// HELPER FUNCTIONS
// ======================

async function checkRateLimit(
  email: string
): Promise<{ allowed: boolean; remaining?: number; retryAfter?: number }> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    limit_key: `parental_consent:${email}`,
    max_attempts: 5,
    window_minutes: 60,
  });

  if (error) {
    console.error("Rate limit check failed:", error);
    return { allowed: true }; // Fail open (but log the error)
  }

  return data;
}

async function sendConsentEmail(
  parentEmail: string,
  approveUrl: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_SENDER,
      to: parentEmail,
      subject: "Parental Consent Required for Keystroke Symphony",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button {
              display: inline-block;
              background: #4CAF50;
              color: #fff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer { font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Parental Consent Request</h2>
            <p>Your child has requested access to <strong>Keystroke Symphony</strong>, an educational platform for improving typing and focus skills.</p>

            <p>Under the Children's Online Privacy Protection Act (COPPA), we require verifiable parental consent before allowing children under 13 to use our platform.</p>

            <p><strong>What access does this grant?</strong></p>
            <ul>
              <li>Free access to Neural Training exercises</li>
              <li>Ability to save progress (no personally identifiable information)</li>
              <li>Access to the Studio feature (rhythm-based learning)</li>
              <li>NO access to community forums</li>
              <li>NO ability to purchase subscriptions or add-ons</li>
            </ul>

            <p>If you consent to your child using Keystroke Symphony, please click the button below:</p>

            <a href="${approveUrl}" class="button">Approve Access</a>

            <p style="font-size: 14px; color: #666;">
              This link will expire in 7 days. If you did not request this or do not recognize this request, please ignore this email.
            </p>

            <div class="footer">
              <p><strong>Your Rights Under COPPA:</strong></p>
              <ul>
                <li>You may review the personal information collected from your child</li>
                <li>You may request that we delete your child's information</li>
                <li>You may revoke consent at any time</li>
              </ul>
              <p>For more information, review our <a href="${SITE_URL}/privacy">Privacy Policy</a> or contact us at privacy@yourdomain.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }),
  });

  if (!res.ok) {
    console.error("Email send failed:", await res.text());
    return false;
  }

  return true;
}

// ======================
// MAIN HANDLER
// ======================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    const validated = ConsentRequestSchema.parse(body);

    const { child_id, parent_email } = validated;

    // Check rate limit
    const rateLimit = await checkRateLimit(parent_email);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
          retry_after: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify child exists and is under 13
    const { data: childProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, birthdate, parent_email, parent_approved")
      .eq("id", child_id)
      .single();

    if (profileError || !childProfile) {
      return new Response(
        JSON.stringify({ error: "Child profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate age
    const age = Math.floor(
      (Date.now() - new Date(childProfile.birthdate).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );

    if (age >= 13) {
      return new Response(
        JSON.stringify({
          error: "Parental consent not required for users 13 and older",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already approved
    if (childProfile.parent_approved) {
      return new Response(
        JSON.stringify({ message: "Parental consent already granted" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate secure token
    const consentToken = nanoid(32);

    // Create consent record
    const { error: insertError } = await supabase
      .from("parental_consents")
      .insert({
        child_id,
        parent_email,
        consent_token: consentToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

    if (insertError) {
      console.error("Failed to create consent record:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create consent request" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Construct approval URL
    const approveUrl = `${SITE_URL}/api/parental-approve?token=${consentToken}`;

    // Send email
    const emailSent = await sendConsentEmail(parent_email, approveUrl);

    if (!emailSent) {
      return new Response(
        JSON.stringify({
          error:
            "Failed to send consent email. Please contact support.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log the request
    await supabase.rpc("log_audit", {
      action_name: "parental_consent_requested",
      resource_name: "parental_consents",
      resource_uuid: child_id,
      extra_metadata: { parent_email, age },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Consent email sent successfully",
        remaining_attempts: rateLimit.remaining,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
