// Shared-Helper: konfigurierbare Zusatz-Empfänger für Nachbuchungs-Ereignisse.
// Liest public.nachbuchung_notification_recipients zur Laufzeit aus —
// Änderungen im Admin-UI wirken sofort ohne Redeploy.

import { logNotification } from './notification-log.ts';

const MAILGUN_DOMAIN = 'kraatz-group.de';
const SENDER = 'Kraatz Group Portal <postmaster@kraatz-group.de>';

export type NachbuchungNotifyEvent = 'send' | 'response' | 'reminder';

const EVENT_FLAG: Record<NachbuchungNotifyEvent, string> = {
  send: 'notify_send',
  response: 'notify_response',
  reminder: 'notify_reminder',
};

const EVENT_TITLE: Record<NachbuchungNotifyEvent, string> = {
  send: 'Nachbuchungs-Anfrage versendet',
  response: 'Nachbuchungsformular ausgefüllt',
  reminder: 'Erinnerung an Dozent versendet',
};

const EVENT_BORDER = '#2e83c2';

export interface NotifyDetails {
  dozentName?: string | null;
  teilnehmerName?: string | null;
  teilnehmerTnNummer?: string | null;
  rechtsgebiet?: string | null;
  extraRows?: Array<[string, string]>;
  bodyText?: string;
}

async function loadRecipients(
  supabase: any,
  event: NachbuchungNotifyEvent,
): Promise<Array<{ email: string; name: string | null }>> {
  const flag = EVENT_FLAG[event];
  const { data, error } = await supabase
    .from('nachbuchung_notification_recipients')
    .select('email, name')
    .eq(flag, true);
  if (error) {
    console.error('❌ Empfängerliste konnte nicht geladen werden:', error);
    return [];
  }
  return (data || []).filter((r: any) => r.email);
}

/**
 * Sendet eine Benachrichtigung an alle für `event` konfigurierten
 * Zusatz-Empfänger. `excludeEmails` werden übersprungen (z. B. Admins,
 * die bereits separat benachrichtigt wurden).
 */
export async function notifyNachbuchungRecipients(params: {
  supabase: any;
  event: NachbuchungNotifyEvent;
  edgeFunction: string;
  details: NotifyDetails;
  excludeEmails?: string[];
  /** Admins (role=admin) zusaetzlich zu den konfigurierten Empfaengern benachrichtigen. */
  includeAdmins?: boolean;
}): Promise<number> {
  const { supabase, event, edgeFunction, details, excludeEmails = [], includeAdmins = false } = params;
  const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
  if (!mailgunApiKey) return 0;

  const recipients = await loadRecipients(supabase, event);

  if (includeAdmins) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('email, full_name, role, additional_roles')
      .eq('is_archived', false)
      .not('email', 'is', null);
    const seen = new Set(recipients.map((r) => r.email.trim().toLowerCase()));
    for (const a of admins || []) {
      const roles = new Set([a.role, ...(a.additional_roles || [])]);
      const email = (a.email || '').trim().toLowerCase();
      if (roles.has('admin') && email && !seen.has(email)) {
        seen.add(email);
        recipients.push({ email: a.email, name: a.full_name });
      }
    }
  }

  const excluded = new Set(excludeEmails.map((e) => e.trim().toLowerCase()));
  const targets = recipients.filter((r) => !excluded.has(r.email.trim().toLowerCase()));
  if (targets.length === 0) return 0;

  const teilnehmerLabel = [details.teilnehmerName, details.teilnehmerTnNummer]
    .filter(Boolean)
    .join(' · ');
  const subject = `${EVENT_TITLE[event]}: ${teilnehmerLabel || 'Nachbuchung'}`;

  const infoRows: Array<[string, string]> = [
    ...(details.dozentName ? [['Dozent', details.dozentName] as [string, string]] : []),
    ...(teilnehmerLabel ? [['Teilnehmer', teilnehmerLabel] as [string, string]] : []),
    ...(details.rechtsgebiet ? [['Rechtsgebiet', details.rechtsgebiet] as [string, string]] : []),
    ...(details.extraRows || []),
  ];

  const tableHtml = infoRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px; width: 45%;"><strong>${label}</strong></td>
          <td style="padding: 8px 0; color: #333; font-size: 14px;">${value}</td>
        </tr>`,
    )
    .join('');

  for (const recipient of targets) {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
          <img src="https://flgf3.img.bh.d.sendibt3.com/im/sh/vejLekvQvWoH.png?u=7126MWSP0tEIBco8FM04ntiyIRc" alt="Kraatz Group" style="height: 60px; margin: 0 auto; display: block;">
        </div>
        <div style="padding: 30px 20px; background-color: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">${EVENT_TITLE[event]}</h2>
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hallo ${recipient.name || ''},
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            ${details.bodyText || ''}
          </p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid ${EVENT_BORDER};">
            <table style="width: 100%; border-collapse: collapse;">${tableHtml}</table>
          </div>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Akademie Kraatz GmbH</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Wilmersdorfer Str. 145/146 - 10585 Berlin</p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Diese E-Mail wurde automatisch vom Portal gesendet.</p>
        </div>
      </div>`;

    const formData = new FormData();
    formData.append('from', SENDER);
    formData.append('to', recipient.email);
    formData.append('subject', subject);
    formData.append('html', emailHtml);
    formData.append('charset', 'utf-8');

    try {
      const response = await fetch(`https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
        method: 'POST',
        headers: { Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}` },
        body: formData,
      });
      const responseBody = await response.text();
      let providerMessageId: string | undefined;
      if (response.ok) {
        try { providerMessageId = JSON.parse(responseBody)?.id; } catch { /* ignore */ }
      } else {
        console.error(`❌ Mailgun error for ${recipient.email}:`, responseBody);
      }
      await logNotification({
        edgeFunction,
        supabaseAdmin: supabase,
        recipientEmail: recipient.email,
        recipientName: recipient.name || undefined,
        subject,
        sender: SENDER,
        status: response.ok ? 'sent' : 'failed',
        providerMessageId,
        errorMessage: response.ok ? undefined : responseBody,
        context: { event, teilnehmerName: details.teilnehmerName, rechtsgebiet: details.rechtsgebiet },
      });
    } catch (err) {
      console.error(`❌ Failed to notify ${recipient.email}:`, err);
      await logNotification({
        edgeFunction,
        supabaseAdmin: supabase,
        recipientEmail: recipient.email,
        recipientName: recipient.name || undefined,
        subject,
        sender: SENDER,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        context: { event, teilnehmerName: details.teilnehmerName, rechtsgebiet: details.rechtsgebiet },
      });
    }
  }

  return targets.length;
}
