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
 *
 * Enhanced with:
 * - Screenshot capture for project completion notifications
 * - Premium notification payloads with project previews
 */

import { db } from '../../db.js';
import { notifications, notificationPreferences } from '../../schema.js';
import { and, desc, eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { getNotificationReplyService } from './notification-reply-service.js';

export type NotificationType = 'feature_complete' | 'error' | 'decision_needed' | 'budget_warning' | 'credentials_needed' | 'build_paused' | 'build_resumed' | 'build_complete' | 'ceiling_warning';
export type NotificationChannel = 'email' | 'sms' | 'slack' | 'discord' | 'webhook' | 'push';

export interface ScreenshotOptions {
    projectId?: string;
    width?: number;
    height?: number;
    quality?: number;
    timeout?: number;
}

export interface ScreenshotResult {
    base64: string;
    url: string | null;
    thumbnailBase64: string;
}

export interface NotificationPayload {
    type: NotificationType;
    title: string;
    message: string;
    featureAgentId: string | null;
    featureAgentName: string;
    actionUrl: string;
    metadata?: Record<string, unknown>;
    // Optional: Enable reply functionality
    enableReply?: boolean;
    sessionId?: string;
    sessionType?: 'ghost_mode' | 'feature_agent' | 'build_loop' | 'fix_my_app';
    projectId?: string;
    suggestedActions?: Array<{
        action: 'yes' | 'no' | 'retry' | 'resume' | 'pause' | 'cancel' | 'approve';
        label: string;
    }>;
}

export interface NotificationPayloadWithScreenshot extends NotificationPayload {
    screenshotUrl?: string;
    screenshotBase64?: string;
    thumbnailBase64?: string;
    projectPreviewUrl?: string;
    projectName?: string;
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

        const notificationId = (created[0] as any).id;

        // Generate reply tokens if reply is enabled
        const replyTokens: Map<string, string> = new Map();
        if (payload.enableReply && payload.sessionId && payload.sessionType) {
            const replyService = getNotificationReplyService();

            // Generate tokens for each suggested action
            const actions = payload.suggestedActions || [{ action: 'yes', label: 'Confirm' }];

            for (const actionDef of actions) {
                const tokenData = await replyService.generateReplyToken({
                    notificationId,
                    userId,
                    projectId: payload.projectId,
                    sessionId: payload.sessionId,
                    sessionType: payload.sessionType,
                    replyAction: actionDef.action,
                });
                replyTokens.set(actionDef.action, tokenData.token);
            }

            // Add reply URLs to metadata for later use
            const replyUrls: Record<string, string> = {};
            replyTokens.forEach((token, action) => {
                replyUrls[action] = replyService.buildReplyUrl(token, action as any);
            });

            // Update notification metadata with reply URLs
            await db.update(notifications)
                .set({
                    metadata: safeJson({
                        ...payload.metadata,
                        featureAgentName: payload.featureAgentName,
                        replyUrls,
                    }),
                })
                .where(eq(notifications.id, notificationId));
        }

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
                    const ok = await this.sendEmail(to, payload, replyTokens);
                    results.push({ channel, ok });
                    continue;
                }
                if (channel === 'sms') {
                    const phone = prefs?.phone || null;
                    if (!phone) {
                        results.push({ channel, ok: false, error: 'No phone preference set' });
                        continue;
                    }
                    const ok = await this.sendSMS(phone, payload, replyTokens);
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
                if (channel === 'discord') {
                    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
                    if (!webhookUrl) {
                        results.push({ channel, ok: false, error: 'Discord webhook not configured (set DISCORD_WEBHOOK_URL)' });
                        continue;
                    }
                    const ok = await this.sendDiscord(webhookUrl, payload);
                    results.push({ channel, ok });
                    continue;
                }
                if (channel === 'webhook') {
                    const webhookUrl = process.env.CUSTOM_WEBHOOK_URL;
                    if (!webhookUrl) {
                        results.push({ channel, ok: false, error: 'Custom webhook not configured (set CUSTOM_WEBHOOK_URL)' });
                        continue;
                    }
                    const ok = await this.sendWebhook(webhookUrl, payload);
                    results.push({ channel, ok });
                    continue;
                }
            } catch (e) {
                results.push({ channel, ok: false, error: e instanceof Error ? e.message : String(e) });
            }
        }

        return results;
    }

    async sendEmail(to: string, payload: NotificationPayload, replyTokens?: Map<string, string>): Promise<boolean> {
        const resendKey = process.env.RESEND_API_KEY;
        const resendFrom = process.env.RESEND_FROM;
        const sendgridKey = process.env.SENDGRID_API_KEY;
        const sendgridFrom = process.env.SENDGRID_FROM;

        const subject = payload.title;
        const html = this.renderEmailHtml(payload, replyTokens);

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

    async sendSMS(phone: string, payload: NotificationPayload, replyTokens?: Map<string, string>): Promise<boolean> {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_FROM;

        if (!sid || !token || !from) {
            throw new Error('Twilio not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)');
        }

        // Build message with reply URL if available
        let messageText = `${payload.title}: ${payload.message}`;

        if (replyTokens && replyTokens.size > 0) {
            const replyService = getNotificationReplyService();
            const firstAction = Array.from(replyTokens.keys())[0];
            const firstToken = replyTokens.get(firstAction);
            if (firstToken) {
                const replyUrl = replyService.buildReplyUrl(firstToken, firstAction as any);
                messageText += ` Reply: ${replyUrl}`;
            }
        } else {
            messageText += ` ${payload.actionUrl}`;
        }

        const body = compactSMS(messageText.trim());
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

    async sendDiscord(webhookUrl: string, payload: NotificationPayload): Promise<boolean> {
        const color =
            payload.type === 'feature_complete' ? 0x2FC979 :
                payload.type === 'error' ? 0xFF4D4D :
                    payload.type === 'decision_needed' ? 0xF5A86C :
                        0xF59E0B;

        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [
                    {
                        title: payload.title,
                        description: payload.message,
                        color,
                        footer: { text: payload.featureAgentName },
                        url: payload.actionUrl,
                        timestamp: new Date().toISOString(),
                    },
                ],
            }),
        });
        return resp.ok;
    }

    async sendWebhook(webhookUrl: string, payload: NotificationPayload): Promise<boolean> {
        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: payload.type,
                title: payload.title,
                message: payload.message,
                actionUrl: payload.actionUrl,
                featureAgentId: payload.featureAgentId,
                featureAgentName: payload.featureAgentName,
                metadata: payload.metadata,
                timestamp: new Date().toISOString(),
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

    private renderEmailHtml(payload: NotificationPayload, replyTokens?: Map<string, string>): string {
        const safeTitle = payload.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeMessage = payload.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        const actionUrl = payload.actionUrl;

        // Build reply buttons if tokens are provided
        let replyButtonsHtml = '';
        if (replyTokens && replyTokens.size > 0 && payload.suggestedActions) {
            const replyService = getNotificationReplyService();
            const buttons: string[] = [];

            for (const actionDef of payload.suggestedActions) {
                const token = replyTokens.get(actionDef.action);
                if (token) {
                    const url = replyService.buildReplyUrl(token, actionDef.action);
                    const buttonStyle = actionDef.action === 'yes' || actionDef.action === 'approve' || actionDef.action === 'resume'
                        ? 'background:linear-gradient(145deg, rgba(47,201,121,0.18), rgba(255,255,255,0.02));border:1px solid rgba(47,201,121,0.28);'
                        : actionDef.action === 'no' || actionDef.action === 'cancel'
                        ? 'background:linear-gradient(145deg, rgba(255,77,77,0.18), rgba(255,255,255,0.02));border:1px solid rgba(255,77,77,0.28);'
                        : 'background:linear-gradient(145deg, rgba(245,168,108,0.18), rgba(255,255,255,0.02));border:1px solid rgba(245,168,108,0.28);';

                    buttons.push(`
                        <a href="${url}" style="display:inline-block;text-decoration:none;border-radius:14px;${buttonStyle}color:#F6EFE7;padding:12px 16px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;margin-right:8px;margin-bottom:8px;">${actionDef.label}</a>
                    `);
                }
            }

            if (buttons.length > 0) {
                replyButtonsHtml = `<div style="margin-top:16px;">${buttons.join('')}</div>`;
            }
        }

        return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0B0E13;color:#EDE8DF;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:640px;margin:0 auto;padding:28px;">
      <div style="border-radius:18px;border:1px solid rgba(245,168,108,0.22);background:linear-gradient(145deg, rgba(255,255,255,0.06), rgba(0,0,0,0.35));box-shadow:0 18px 40px rgba(0,0,0,0.45);padding:22px;">
        <div style="font-weight:800;letter-spacing:-0.02em;font-size:18px;margin-bottom:10px;">${safeTitle}</div>
        <div style="opacity:0.86;line-height:1.55;font-size:14px;margin-bottom:18px;">${safeMessage}</div>
        ${replyButtonsHtml || (actionUrl ? `<a href="${actionUrl}" style="display:inline-block;text-decoration:none;border-radius:14px;border:1px solid rgba(245,168,108,0.28);background:linear-gradient(145deg, rgba(245,168,108,0.18), rgba(255,255,255,0.02));color:#F6EFE7;padding:12px 14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">Open in KripTik</a>` : '')}
        <div style="margin-top:18px;opacity:0.62;font-size:12px;">KripTik AI · ${payload.featureAgentName}</div>
      </div>
    </div>
  </body>
</html>
`.trim();
    }

    /**
     * Render email HTML with screenshot preview
     */
    private renderEmailHtmlWithScreenshot(payload: NotificationPayloadWithScreenshot): string {
        const safeTitle = payload.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeMessage = payload.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        const actionUrl = payload.actionUrl;
        const projectName = payload.projectName || 'Your Project';
        const screenshot = payload.screenshotBase64 || payload.thumbnailBase64;

        return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0B0E13;color:#EDE8DF;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:640px;margin:0 auto;padding:28px;">
      <div style="border-radius:18px;border:1px solid rgba(245,168,108,0.22);background:linear-gradient(145deg, rgba(255,255,255,0.06), rgba(0,0,0,0.35));box-shadow:0 18px 40px rgba(0,0,0,0.45);overflow:hidden;">
        ${screenshot ? `
        <div style="position:relative;">
          <img src="data:image/png;base64,${screenshot}" alt="${projectName} Preview" style="width:100%;height:200px;object-fit:cover;object-position:top;display:block;" />
          <div style="position:absolute;inset:0;background:linear-gradient(to bottom, transparent 50%, rgba(11,14,19,0.9) 100%);"></div>
        </div>
        ` : ''}
        <div style="padding:22px;">
          <div style="font-weight:800;letter-spacing:-0.02em;font-size:18px;margin-bottom:10px;">${safeTitle}</div>
          <div style="opacity:0.86;line-height:1.55;font-size:14px;margin-bottom:18px;">${safeMessage}</div>
          ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;text-decoration:none;border-radius:14px;border:1px solid rgba(245,168,108,0.28);background:linear-gradient(145deg, rgba(245,168,108,0.18), rgba(255,255,255,0.02));color:#F6EFE7;padding:12px 14px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">Open in KripTik</a>` : ''}
          <div style="margin-top:18px;opacity:0.62;font-size:12px;">KripTik AI - ${payload.featureAgentName}</div>
        </div>
      </div>
    </div>
  </body>
</html>
`.trim();
    }

    /**
     * Capture a screenshot of the project preview
     * Uses Playwright for headless browser rendering
     */
    async captureProjectScreenshot(
        previewUrl: string,
        options: ScreenshotOptions = {}
    ): Promise<ScreenshotResult | null> {
        const width = options.width || 1200;
        const height = options.height || 630;
        const timeout = options.timeout || 30000;

        try {
            const playwright = await import('playwright');
            const browser = await playwright.chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });

            const context = await browser.newContext({
                viewport: { width, height },
                deviceScaleFactor: 1,
            });

            const page = await context.newPage();

            await page.goto(previewUrl, {
                waitUntil: 'networkidle',
                timeout,
            });

            // Wait for animations to settle
            await page.waitForTimeout(2000);

            // Take full screenshot
            const screenshotBuffer = await page.screenshot({
                type: 'png',
                fullPage: false,
            });

            await browser.close();

            const base64 = screenshotBuffer.toString('base64');

            // Create thumbnail (compressed version for DB storage)
            const thumbnailBase64 = await this.compressScreenshot(base64, 400, 210, 0.7);

            // Store to file system if projectId provided
            let url: string | null = null;
            if (options.projectId) {
                url = await this.storeScreenshot(base64, options.projectId);
            }

            return {
                base64,
                url,
                thumbnailBase64,
            };
        } catch (error) {
            console.error('[NotificationService] Screenshot capture failed:', error);
            return null;
        }
    }

    /**
     * Compress screenshot for storage efficiency
     */
    private async compressScreenshot(
        base64: string,
        maxWidth: number,
        maxHeight: number,
        quality: number
    ): Promise<string> {
        try {
            const sharp = await import('sharp');
            const inputBuffer = Buffer.from(base64, 'base64');

            const outputBuffer = await sharp.default(inputBuffer)
                .resize(maxWidth, maxHeight, { fit: 'cover', position: 'top' })
                .png({ quality: Math.round(quality * 100), compressionLevel: 9 })
                .toBuffer();

            return outputBuffer.toString('base64');
        } catch {
            // Fallback: return truncated original if sharp fails
            const maxSize = 50000;
            return base64.length > maxSize ? base64.slice(0, maxSize) : base64;
        }
    }

    /**
     * Store screenshot to file system
     */
    private async storeScreenshot(base64: string, projectId: string): Promise<string | null> {
        try {
            const screenshotsDir = path.join(process.cwd(), 'uploads', 'screenshots');

            // Ensure directory exists
            if (!fs.existsSync(screenshotsDir)) {
                fs.mkdirSync(screenshotsDir, { recursive: true });
            }

            const filename = `${projectId}-${Date.now()}.png`;
            const filepath = path.join(screenshotsDir, filename);

            fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));

            // Return relative URL path
            return `/uploads/screenshots/${filename}`;
        } catch (error) {
            console.error('[NotificationService] Failed to store screenshot:', error);
            return null;
        }
    }

    /**
     * Send notification with screenshot capture
     * Automatically captures screenshot if previewUrl is provided
     */
    async sendNotificationWithScreenshot(
        userId: string,
        channels: NotificationChannel[],
        payload: NotificationPayloadWithScreenshot,
        previewUrl?: string
    ): Promise<NotificationResult[]> {
        // Capture screenshot if preview URL provided and no screenshot exists
        if (previewUrl && !payload.screenshotBase64 && !payload.thumbnailBase64) {
            try {
                const screenshot = await this.captureProjectScreenshot(previewUrl, {
                    projectId: payload.metadata?.projectId as string | undefined,
                    timeout: 20000,
                });

                if (screenshot) {
                    payload.screenshotBase64 = screenshot.base64;
                    payload.thumbnailBase64 = screenshot.thumbnailBase64;
                    payload.screenshotUrl = screenshot.url || undefined;
                }
            } catch (error) {
                console.error('[NotificationService] Screenshot capture failed, continuing without:', error);
            }
        }

        // Build metadata with screenshot info
        const metadataWithScreenshot = {
            ...payload.metadata,
            screenshotUrl: payload.screenshotUrl,
            screenshotBase64: payload.thumbnailBase64 || payload.screenshotBase64?.slice(0, 80000),
            projectPreviewUrl: previewUrl,
            projectName: payload.projectName,
        };

        // Store notification in DB
        const created = await db.insert(notifications).values({
            userId,
            featureAgentId: payload.featureAgentId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            actionUrl: payload.actionUrl,
            channels: JSON.stringify(channels),
            metadata: safeJson({
                ...metadataWithScreenshot,
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
                    const ok = await this.sendEmailWithScreenshot(to, payload);
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
                    const ok = await this.sendSlackWithScreenshot(webhookUrl, payload);
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
                if (channel === 'discord') {
                    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
                    if (!webhookUrl) {
                        results.push({ channel, ok: false, error: 'Discord webhook not configured (set DISCORD_WEBHOOK_URL)' });
                        continue;
                    }
                    const ok = await this.sendDiscord(webhookUrl, payload);
                    results.push({ channel, ok });
                    continue;
                }
                if (channel === 'webhook') {
                    const webhookUrl = process.env.CUSTOM_WEBHOOK_URL;
                    if (!webhookUrl) {
                        results.push({ channel, ok: false, error: 'Custom webhook not configured (set CUSTOM_WEBHOOK_URL)' });
                        continue;
                    }
                    const ok = await this.sendWebhook(webhookUrl, payload);
                    results.push({ channel, ok });
                    continue;
                }
            } catch (e) {
                results.push({ channel, ok: false, error: e instanceof Error ? e.message : String(e) });
            }
        }

        return results;
    }

    /**
     * Send email with screenshot attachment
     */
    private async sendEmailWithScreenshot(to: string, payload: NotificationPayloadWithScreenshot): Promise<boolean> {
        const resendKey = process.env.RESEND_API_KEY;
        const resendFrom = process.env.RESEND_FROM;
        const sendgridKey = process.env.SENDGRID_API_KEY;
        const sendgridFrom = process.env.SENDGRID_FROM;

        const subject = payload.title;
        const html = this.renderEmailHtmlWithScreenshot(payload);

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

        // Fallback to regular email
        return this.sendEmail(to, payload);
    }

    /**
     * Send Slack message with screenshot
     */
    private async sendSlackWithScreenshot(webhookUrl: string, payload: NotificationPayloadWithScreenshot): Promise<boolean> {
        const color =
            payload.type === 'feature_complete' ? '#2FC979' :
                payload.type === 'error' ? '#FF4D4D' :
                    payload.type === 'decision_needed' ? '#F5A86C' :
                        '#F59E0B';

        const blocks: any[] = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*${payload.title}*\n${payload.message}`,
                },
            },
        ];

        // Add screenshot image if URL available
        if (payload.screenshotUrl) {
            blocks.push({
                type: 'image',
                image_url: payload.screenshotUrl,
                alt_text: `${payload.projectName || 'Project'} Preview`,
            });
        }

        // Add action button
        if (payload.actionUrl) {
            blocks.push({
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: { type: 'plain_text', text: 'Open Project' },
                        url: payload.actionUrl,
                        style: 'primary',
                    },
                ],
            });
        }

        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attachments: [{ color, blocks }],
            }),
        });
        return resp.ok;
    }

    /**
     * List notifications for a specific project
     */
    async listProjectNotifications(userId: string, projectId: string, limit = 20) {
        const allNotifications = await this.listNotifications(userId, 200);

        return allNotifications.filter((n: any) => {
            const meta = n.metadata;
            return meta?.projectId === projectId;
        }).slice(0, limit);
    }

    /**
     * Get unread notification count for a project
     */
    async getProjectUnreadCount(userId: string, projectId: string): Promise<number> {
        const projectNotifications = await this.listProjectNotifications(userId, projectId);
        return projectNotifications.filter((n: any) => !n.read).length;
    }
}

let singleton: NotificationService | null = null;
export function getNotificationService(): NotificationService {
    if (!singleton) singleton = new NotificationService();
    return singleton;
}


