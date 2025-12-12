/**
 * Notification Service
 *
 * Sends notifications through multiple channels:
 * - Email (Resend or SendGrid via HTTPS API)
 * - SMS (Twilio via HTTPS API)
 * - Slack (Incoming Webhook)
 * - Push (Web Push API) - stored subscriptions; send requires VAPID keys
 *
 * Also stores an in-app notification record in the database for the dashboard UI.
 */

import { db } from '../../db.js';
import { notifications, notificationPreferences } from '../../schema.js';
import { and, desc, eq } from 'drizzle-orm';

export type NotificationType = 'feature_complete' | 'error' | 'decision_needed' | 'budget_warning';
export type NotificationChannel = 'email' | 'sms' | 'slack' | 'push';

export interface NotificationPayload {
    type: NotificationType;
    title: string;
    message: string;
    featureAgentId: string;
    featureAgentName: string;
    actionUrl: string;
    metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
    userId: string;
    email: string | null;
    phone: string | null;
    slackWebhook: string | null;
    pushEnabled: boolean;
    pushSubscription: unknown | null; // Web Push subscription JSON
}

export interface NotificationResult {
    channel: NotificationChannel;
    ok: boolean;
    error?: string;
}

function compactSMS(text: string): string {
    const oneLine = text.replace(/\s+/g, ' ').trim();
    if (oneLine.length <= 160) return oneLine;
    return `${oneLine.slice(0, 157)}...`;
}

function safeJson(value: unknown): string | null {
    if (value === undefined) return null;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

export class NotificationService {
    async sendNotification(
        userId: string,
        channels: NotificationChannel[],
        payload: NotificationPayload
    ): Promise<NotificationResult[]> {
        // Always store in DB first (in-app notifications), regardless of channel success.
        const created = await db.insert(notifications).values({
            userId,
            featureAgentId: payload.featureAgentId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            actionUrl: payload.actionUrl,
            channels: JSON.stringify(channels),
            metadata: safeJson({
                ...payload.metadata,
                featureAgentName: payload.featureAgentName,
            }),
            read: false,
            dismissed: false,
        }).returning();

        void created;

        const prefs = await this.getPreferences(userId);
        const results: NotificationResult[] = [];

        for (const channel of channels) {
            try {
                if (channel === 'email') {
                    const to = prefs?.email || null;
                    if (!to) {
                        results.push({ channel, ok: false, error: 'No email preference set' });
                        continue;
                    }
                    const ok = await this.sendEmail(to, payload);
                    results.push({ channel, ok });
                    continue;
                }
                if (channel === 'sms') {
                    const phone = prefs?.phone || null;
                    if (!phone) {
                        results.push({ channel, ok: false, error: 'No phone preference set' });
                        continue;
                    }
                    const ok = await this.sendSMS(phone, payload);
                    results.push({ channel, ok });
                    continue;
                }
                if (channel === 'slack') {
                    const webhookUrl = prefs?.slackWebhook || null;
                    if (!webhookUrl) {
                        results.push({ channel, ok: false, error: 'No slack webhook preference set' });
                        continue;
                    }
                    const ok = await this.sendSlack(webhookUrl, payload);
                    results.push({ channel, ok });
                    continue;
                }
                if (channel === 'push') {
                    if (!prefs?.pushEnabled || !prefs.pushSubscription) {
                        results.push({ channel, ok: false, error: 'Push not enabled or no subscription saved' });
                        continue;
                    }
                    const ok = await this.sendPush(prefs.pushSubscription, payload);
                    results.push({ channel, ok });
                    continue;
                }
            } catch (e) {
                results.push({ channel, ok: false, error: e instanceof Error ? e.message : String(e) });
            }
        }

        return results;
    }

    async sendEmail(to: string, payload: NotificationPayload): Promise<boolean> {
        const resendKey = process.env.RESEND_API_KEY;
        const resendFrom = process.env.RESEND_FROM;
        const sendgridKey = process.env.SENDGRID_API_KEY;
        const sendgridFrom = process.env.SENDGRID_FROM;

        const subject = payload.title;
        const html = this.renderEmailHtml(payload);

        if (resendKey && resendFrom) {
            const resp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resendKey}`,
                },
                body: JSON.stringify({
                    from: resendFrom,
                    to: [to],
                    subject,
                    html,
                }),
            });
            return resp.ok;
        }

        if (sendgridKey && sendgridFrom) {
            const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sendgridKey}`,
                },
                body: JSON.stringify({
                    personalizations: [{ to: [{ email: to }], subject }],
                    from: { email: sendgridFrom },
                    content: [{ type: 'text/html', value: html }],
                }),
            });
            return resp.ok;
        }

        throw new Error('Email provider not configured (set RESEND_API_KEY+RESEND_FROM or SENDGRID_API_KEY+SENDGRID_FROM)');
    }

    async sendSMS(phone: string, payload: NotificationPayload): Promise<boolean> {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_FROM;

        if (!sid || !token || !from) {
            throw new Error('Twilio not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)');
        }

        const body = compactSMS(`${payload.title}: ${payload.message} ${payload.actionUrl}`.trim());
        const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;

        const form = new URLSearchParams();
        form.set('From', from);
        form.set('To', phone);
        form.set('Body', body);

        const auth = Buffer.from(`${sid}:${token}`).toString('base64');
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
        });
        return resp.ok;
    }

    async sendSlack(webhookUrl: string, payload: NotificationPayload): Promise<boolean> {
        const color =
            payload.type === 'feature_complete' ? '#2FC979' :
                payload.type === 'error' ? '#FF4D4D' :
                    payload.type === 'decision_needed' ? '#F5A86C' :
                        '#F59E0B';

        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attachments: [
                    {
                        color,
                        title: payload.title,
                        text: payload.message,
                        footer: payload.featureAgentName,
                        actions: payload.actionUrl ? [{
                            type: 'button',
                            text: 'Open',
                            url: payload.actionUrl,
                        }] : [],
                    },
                ],
            }),
        });
        return resp.ok;
    }

    async sendPush(subscription: unknown, payload: NotificationPayload): Promise<boolean> {
        // Web Push requires VAPID keys. We implement sending via dynamic import of `web-push`
        // so the service compiles even if push isn't configured.
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        const subject = process.env.VAPID_SUBJECT || (process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app');

        if (!publicKey || !privateKey) {
            throw new Error('Web Push not configured (set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)');
        }

        const webpush = await import('web-push');
        webpush.setVapidDetails(subject, publicKey, privateKey);

        const data = JSON.stringify({
            title: payload.title,
            message: payload.message,
            url: payload.actionUrl,
            type: payload.type,
            featureAgentId: payload.featureAgentId,
        });

        try {
            await webpush.sendNotification(subscription as any, data);
            return true;
        } catch (e: any) {
            // subscription may be expired; caller can disable in prefs as needed
            throw new Error(e?.message || 'Push send failed');
        }
    }

    async savePreferences(prefs: NotificationPreferences): Promise<void> {
        const existing = await db.select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, prefs.userId))
            .limit(1);

        const now = new Date().toISOString();
        const payload = {
            email: prefs.email,
            phone: prefs.phone,
            slackWebhook: prefs.slackWebhook,
            pushEnabled: prefs.pushEnabled,
            pushSubscription: safeJson(prefs.pushSubscription),
            updatedAt: now,
        };

        if (existing.length > 0) {
            await db.update(notificationPreferences)
                .set(payload as any)
                .where(eq(notificationPreferences.userId, prefs.userId));
            return;
        }

        await db.insert(notificationPreferences).values({
            userId: prefs.userId,
            ...payload,
        } as any);
    }

    async getPreferences(userId: string): Promise<NotificationPreferences | null> {
        const rows = await db.select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId))
            .limit(1);
        if (rows.length === 0) return null;

        const row = rows[0] as any;
        return {
            userId: row.userId,
            email: row.email ?? null,
            phone: row.phone ?? null,
            slackWebhook: row.slackWebhook ?? null,
            pushEnabled: !!row.pushEnabled,
            pushSubscription: row.pushSubscription ? JSON.parse(row.pushSubscription) : null,
        };
    }

    async listNotifications(userId: string, limit = 50) {
        const rows = await db.select()
            .from(notifications)
            .where(and(eq(notifications.userId, userId), eq(notifications.dismissed, false)))
            .orderBy(desc(notifications.createdAt))
            .limit(limit);

        return rows.map((r: any) => ({
            id: r.id,
            type: r.type as NotificationType,
            title: r.title,
            message: r.message,
            featureAgentId: r.featureAgentId,
            featureAgentName: (() => {
                try {
                    const m = r.metadata ? JSON.parse(r.metadata) : null;
                    return m?.featureAgentName || 'Feature Agent';
                } catch {
                    return 'Feature Agent';
                }
            })(),
            actionUrl: r.actionUrl,
            read: !!r.read,
            dismissed: !!r.dismissed,
            createdAt: new Date(r.createdAt),
            metadata: r.metadata ? (() => { try { return JSON.parse(r.metadata); } catch { return null; } })() : null,
        }));
    }

    async markRead(userId: string, notificationId: string): Promise<void> {
        await db.update(notifications)
            .set({ read: true })
            .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
    }

    async dismiss(userId: string, notificationId: string): Promise<void> {
        await db.update(notifications)
            .set({ dismissed: true })
            .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
    }

    private renderEmailHtml(payload: NotificationPayload): string {
        const safeTitle = payload.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeMessage = payload.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        const actionUrl = payload.actionUrl;

        return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0B0E13;color:#EDE8DF;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:640px;margin:0 auto;padding:28px;">
      <div style="border-radius:18px;border:1px solid rgba(245,168,108,0.22);background:linear-gradient(145deg, rgba(255,255,255,0.06), rgba(0,0,0,0.35));box-shadow:0 18px 40px rgba(0,0,0,0.45);padding:22px;">
        <div style="font-weight:800;letter-spacing:-0.02em;font-size:18px;margin-bottom:10px;">${safeTitle}</div>
        <div style="opacity:0.86;line-height:1.55;font-size:14px;margin-bottom:18px;">${safeMessage}</div>
        ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;text-decoration:none;border-radius:14px;border:1px solid rgba(245,168,108,0.28);background:linear-gradient(145deg, rgba(245,168,108,0.18), rgba(255,255,255,0.02));color:#F6EFE7;padding:12px 14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">Open in KripTik</a>` : ''}
        <div style="margin-top:18px;opacity:0.62;font-size:12px;">KripTik AI · ${payload.featureAgentName}</div>
      </div>
    </div>
  </body>
</html>
`.trim();
    }
}

let singleton: NotificationService | null = null;
export function getNotificationService(): NotificationService {
    if (!singleton) singleton = new NotificationService();
    return singleton;
}


