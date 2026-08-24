/// <reference path="../deno.d.ts" />
/// <reference path="../npm-imports.d.ts" />

// Shared helper for logging email sends to the notification_logs table.
// Used by all *-notify edge functions so the team can verify in the
// portal who received which email and when, without Mailgun API access.
//
// Usage:
//   import { logNotification } from "../_shared/notification-log.ts";
//   await logNotification({
//     edgeFunction: "klausur-notify",
//     supabaseAdmin,
//     recipientEmail: dozentEmail,
//     recipientName: dozentName,
//     subject: emailSubject,
//     sender: "Kraatz Group Portal <postmaster@kraatz-group.de>",
//     status: "sent",
//     providerMessageId: emailResult?.id,
//     context: { klausurTitle, legalArea, dozentId },
//     payload: { dozentEmail, dozentName, teilnehmerName, klausurTitle, legalArea },
//   });

import { createClient } from "npm:@supabase/supabase-js@2";

export interface LogNotificationParams {
  /** Name of the edge function that sent the email (e.g. "klausur-notify"). */
  edgeFunction: string;
  /** Supabase admin client (service role key) — used to bypass RLS. */
  supabaseAdmin: any;
  /** Recipient email address. */
  recipientEmail: string;
  /** Recipient display name (optional). */
  recipientName?: string;
  /** Email subject line. */
  subject: string;
  /** Sender ("from") address. */
  sender?: string;
  /** "sent" or "failed". */
  status: "sent" | "failed";
  /** Mailgun message id from the send response (when available). */
  providerMessageId?: string;
  /** Error message when status = "failed". */
  errorMessage?: string;
  /** Structured context about what triggered the email (ids, etc.). */
  context?: Record<string, unknown>;
  /** The payload sent to the provider (must not contain secrets). */
  payload?: Record<string, unknown>;
}

/**
 * Inserts a row into notification_logs. Failures are caught and logged
 * so they never break the email send flow.
 */
export async function logNotification(params: LogNotificationParams): Promise<void> {
  try {
    const { error } = await params.supabaseAdmin.from("notification_logs").insert({
      edge_function: params.edgeFunction,
      sender: params.sender ?? null,
      recipient_email: params.recipientEmail,
      recipient_name: params.recipientName ?? null,
      subject: params.subject,
      status: params.status,
      provider: "mailgun",
      provider_message_id: params.providerMessageId ?? null,
      error_message: params.errorMessage ?? null,
      context: params.context ?? null,
      payload: params.payload ?? null,
    });
    if (error) {
      console.error(`[notification-log] Failed to insert log row:`, error.message);
    }
  } catch (err) {
    // Never let logging break the email flow
    console.error(`[notification-log] Unexpected error logging notification:`, err);
  }
}

/**
 * Convenience: creates a Supabase admin client from env vars. Most edge
 * functions already create their own client; this is for those that don't.
 */
export function createAdminClient(): any {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}
