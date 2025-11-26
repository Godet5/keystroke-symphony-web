// Supabase Edge Function: Parental Approval v2 (Enhanced)
// Purpose: Process parental consent approval links
// Created: 2025-11-25

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SITE_URL = Deno.env.get("SITE_URL") || "https://yourdomain.com";

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(renderErrorPage("Missing or invalid token"), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    // Get client IP and user agent for audit
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    const userAgent = req.headers.get("user-agent");

    // Call approve function (includes all validation)
    const { data, error } = await supabase.rpc("approve_parental_consent", {
      token_input: token,
      ip_addr: ipAddress,
      ua: userAgent,
    });

    if (error || !data.success) {
      const errorMessage = data?.error || error?.message || "Unknown error";
      return new Response(renderErrorPage(errorMessage), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Success!
    return new Response(renderSuccessPage(data.parent_email), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Approval error:", error);
    return new Response(renderErrorPage("Internal server error"), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});

function renderSuccessPage(parentEmail: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consent Approved - Keystroke Symphony</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      text-align: center;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: #4CAF50;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      color: white;
    }
    h1 { color: #333; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; margin-bottom: 12px; }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin-top: 20px;
      transition: background 0.3s;
    }
    .button:hover { background: #5568d3; }
  </style>
</head>
<body>
  <div class="card">
    <div class="success-icon">✓</div>
    <h1>Thank You!</h1>
    <p>Your consent has been recorded successfully.</p>
    <p>Your child now has free subscriber access to Keystroke Symphony, including:</p>
    <ul style="text-align: left; display: inline-block;">
      <li>Full Neural Training exercises</li>
      <li>Progress saving and tracking</li>
      <li>Studio feature access</li>
    </ul>
    <p style="font-size: 14px; color: #999; margin-top: 20px;">
      Confirmation sent to: <strong>${parentEmail}</strong>
    </p>
    <a href="${SITE_URL}" class="button">Return to Home</a>
  </div>
</body>
</html>
  `;
}

function renderErrorPage(errorMessage: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Keystroke Symphony</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      text-align: center;
    }
    .error-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: #f44336;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      color: white;
    }
    h1 { color: #333; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; }
    .error-details {
      background: #ffebee;
      padding: 12px;
      border-radius: 6px;
      margin-top: 16px;
      color: #c62828;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background: #666;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-icon">✗</div>
    <h1>Unable to Process Consent</h1>
    <p>We encountered an error while processing your consent approval.</p>
    <div class="error-details">${errorMessage}</div>
    <p style="font-size: 14px; color: #999; margin-top: 20px;">
      If you believe this is an error, please contact support at privacy@yourdomain.com
    </p>
    <a href="${SITE_URL}" class="button">Return to Home</a>
  </div>
</body>
</html>
  `;
}
