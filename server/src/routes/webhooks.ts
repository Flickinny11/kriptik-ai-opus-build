/**
 * Webhook Routes for Notification Replies
 *
 * Handles incoming webhooks from:
 * - Twilio (SMS replies)
 * - SendGrid (Email replies via Inbound Parse)
 * - Web Push (action clicks)
 * - Slack (button interactions)
 *
 * All webhooks route to the NotificationReplyService for processing,
 * which then triggers the appropriate agent orchestrator for re-iteration.
 */

import { Router, type Request, type Response } from 'express';
import { getNotificationReplyService, type ReplyAction } from '../services/notifications/notification-reply-service.js';
import crypto from 'crypto';
import {
    getWebhookEndpoint,
    verifySignature,
    storeWebhookEvent,
    processWebhookEvent,
    getOrCreateWebhookEndpoint,
    getRecentEvents,
} from '../services/webhooks/webhook-generator.js';

const router = Router();
const replyService = getNotificationReplyService();

/**
 * Generic reply handler (via URL with token)
 * Used for simple button clicks in emails/push/slack
 *
 * GET /api/webhooks/reply?token=<token>&action=<action>
 */
router.get('/reply', async (req: Request, res: Response) => {
    try {
        const { token, action } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Missing token parameter' });
        }

        const replyAction = (action as ReplyAction) || 'yes';

        const result = await replyService.processReply({
            token,
            channel: 'email', // Default, can be overridden
            replyType: 'button_click',
            replyAction,
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error || 'Failed to process reply' });
        }

        // Return success page or redirect
        const frontendUrl = process.env.FRONTEND_URL || 'https://kriptik.app';
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Reply Processed - KripTik AI</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #0B0E13;
            color: #EDE8DF;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            max-width: 480px;
            padding: 32px;
            text-align: center;
        }
        .card {
            background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(0,0,0,0.35));
            border: 1px solid rgba(245,168,108,0.22);
            border-radius: 18px;
            padding: 32px;
            box-shadow: 0 18px 40px rgba(0,0,0,0.45);
        }
        h1 {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.02em;
            margin: 0 0 16px 0;
            color: #F5A86C;
        }
        p {
            opacity: 0.86;
            line-height: 1.6;
            margin: 0 0 24px 0;
        }
        .success-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        a {
            display: inline-block;
            background: linear-gradient(145deg, rgba(245,168,108,0.18), rgba(255,255,255,0.02));
            border: 1px solid rgba(245,168,108,0.28);
            color: #F6EFE7;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 14px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-size: 12px;
        }
        a:hover {
            background: linear-gradient(145deg, rgba(245,168,108,0.28), rgba(255,255,255,0.05));
        }
        .detail {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid rgba(255,255,255,0.1);
            opacity: 0.62;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="success-icon">✓</div>
            <h1>Reply Processed</h1>
            <p>Your response has been received and the agent ${result.orchestrationTriggered ? 'has been notified to continue' : 'will be updated'}.</p>
            <a href="${frontendUrl}">Return to KripTik</a>
            ${result.sessionId ? `
                <div class="detail">
                    ${result.sessionType === 'ghost_mode' ? 'Ghost Mode session' :
                      result.sessionType === 'feature_agent' ? 'Feature Agent' :
                      result.sessionType === 'build_loop' ? 'Build session' : 'Session'}
                    will ${result.orchestrationTriggered ? 'resume shortly' : 'be updated'}.
                </div>
            ` : ''}
        </div>
    </div>
</body>
</html>
        `);
    } catch (error) {
        console.error('[Webhooks] Reply handler error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Twilio SMS Reply Webhook
 *
 * POST /api/webhooks/twilio/sms
 *
 * Twilio sends SMS replies as application/x-www-form-urlencoded
 * Expected fields:
 * - From: sender phone number
 * - Body: message text
 * - MessageSid: unique message ID
 */
router.post('/twilio/sms', async (req: Request, res: Response) => {
    try {
        const { From, Body, MessageSid } = req.body || {};

        if (!Body) {
            return res.status(400).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        }

        // Extract token from message body
        // Users might reply with: "<token> yes" or just "yes" (if we included token in message)
        // For simplicity, we'll look for a token pattern in the message
        const tokenMatch = Body.match(/[A-Za-z0-9_-]{43}/); // Base64url token pattern

        if (!tokenMatch) {
            // No token found, send help message
            return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Please use the link in the notification to respond, or reply with your token followed by YES/NO.</Message>
</Response>`);
        }

        const token = tokenMatch[0];
        const result = await replyService.processReply({
            token,
            channel: 'sms',
            replyType: 'text',
            replyText: Body,
            rawPayload: { From, Body, MessageSid },
        });

        if (!result.success) {
            return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Sorry, we couldn't process your reply. The link may have expired.</Message>
</Response>`);
        }

        // Send confirmation via TwiML
        const actionText = result.action === 'yes' ? 'approved' :
                          result.action === 'no' ? 'declined' :
                          result.action === 'retry' ? 'retry requested' :
                          result.action === 'resume' ? 'resume requested' :
                          'received';

        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Thanks! Your response (${actionText}) has been processed. ${result.orchestrationTriggered ? 'The agent will continue shortly.' : ''}</Message>
</Response>`);
    } catch (error) {
        console.error('[Webhooks] Twilio SMS error:', error);
        res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>An error occurred processing your reply.</Message></Response>');
    }
});

/**
 * Verify Twilio webhook signature
 * Twilio signs webhooks with X-Twilio-Signature header
 */
function verifyTwilioSignature(req: Request): boolean {
    const signature = req.headers['x-twilio-signature'] as string;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!signature || !authToken) {
        return false;
    }

    // Twilio signature verification
    // https://www.twilio.com/docs/usage/security#validating-requests
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const params = req.body;

    // Build the data string
    let data = url;
    Object.keys(params).sort().forEach((key) => {
        data += key + params[key];
    });

    // Create HMAC-SHA1 signature
    const expectedSignature = crypto
        .createHmac('sha1', authToken)
        .update(Buffer.from(data, 'utf-8'))
        .digest('base64');

    return signature === expectedSignature;
}

/**
 * SendGrid Inbound Parse Webhook
 *
 * POST /api/webhooks/sendgrid/parse
 *
 * SendGrid sends email replies as multipart/form-data
 * Expected fields:
 * - from: sender email
 * - to: recipient email
 * - subject: email subject
 * - text: plain text body
 * - html: HTML body
 */
router.post('/sendgrid/parse', async (req: Request, res: Response) => {
    try {
        const { from, to, subject, text, html } = req.body || {};

        if (!text && !html) {
            return res.status(400).json({ error: 'No email body' });
        }

        const body = text || html;

        // Extract token from email body or subject
        // Look for reply URL pattern or direct token
        const urlMatch = body.match(/\/api\/webhooks\/reply\?token=([A-Za-z0-9_-]+)/);
        const tokenMatch = body.match(/Token:\s*([A-Za-z0-9_-]{43})/i);

        const token = urlMatch?.[1] || tokenMatch?.[1];

        if (!token) {
            console.warn('[Webhooks] No token found in email reply:', { from, subject });
            return res.status(200).json({ message: 'No action required' });
        }

        const result = await replyService.processReply({
            token,
            channel: 'email',
            replyType: 'text',
            replyText: body,
            rawPayload: { from, to, subject, text, html },
        });

        if (!result.success) {
            console.error('[Webhooks] SendGrid parse error:', result.error);
        }

        res.status(200).json({ success: result.success, action: result.action });
    } catch (error) {
        console.error('[Webhooks] SendGrid parse error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Web Push Action Click Webhook
 *
 * POST /api/webhooks/push/action
 *
 * Handles action button clicks from web push notifications
 * Expected body:
 * - token: reply token
 * - action: the action clicked (yes/no/retry/etc)
 */
router.post('/push/action', async (req: Request, res: Response) => {
    try {
        const { token, action } = req.body || {};

        if (!token) {
            return res.status(400).json({ error: 'Missing token' });
        }

        const result = await replyService.processReply({
            token,
            channel: 'push',
            replyType: 'button_click',
            replyAction: action as ReplyAction || 'yes',
            rawPayload: req.body,
        });

        res.json({
            success: result.success,
            action: result.action,
            error: result.error,
            orchestrationTriggered: result.orchestrationTriggered,
        });
    } catch (error) {
        console.error('[Webhooks] Push action error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Slack Interactive Message Webhook
 *
 * POST /api/webhooks/slack/interactive
 *
 * Handles button clicks from Slack messages
 * Slack sends the payload as application/x-www-form-urlencoded with a 'payload' field
 */
router.post('/slack/interactive', async (req: Request, res: Response) => {
    try {
        const payload = JSON.parse(req.body.payload || '{}');
        const { actions, callback_id, response_url } = payload;

        if (!actions || actions.length === 0) {
            return res.status(400).json({ error: 'No actions in payload' });
        }

        const action = actions[0];
        const token = callback_id; // We'll store the token as callback_id when sending

        if (!token) {
            return res.status(400).json({ error: 'Missing token (callback_id)' });
        }

        const result = await replyService.processReply({
            token,
            channel: 'slack',
            replyType: 'button_click',
            replyAction: action.value as ReplyAction,
            rawPayload: payload,
        });

        // Send response back to Slack
        if (response_url) {
            const actionText = result.action === 'yes' ? 'approved' :
                              result.action === 'no' ? 'declined' :
                              result.action === 'retry' ? 'retry requested' :
                              result.action === 'resume' ? 'resume requested' :
                              'received';

            await fetch(response_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `✓ Your response (${actionText}) has been processed. ${result.orchestrationTriggered ? 'The agent will continue shortly.' : ''}`,
                    replace_original: false,
                }),
            });
        }

        res.json({ success: result.success });
    } catch (error) {
        console.error('[Webhooks] Slack interactive error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'notification-webhooks' });
});

// ============================================================================
// INTEGRATION WEBHOOK ENDPOINTS
// Dynamic webhook URLs for each project/integration
// ============================================================================

/**
 * Create/Get webhook endpoint for a project
 * POST /api/webhooks/endpoints
 */
router.post('/endpoints', async (req: Request, res: Response) => {
    try {
        const { projectId, integrationId, events } = req.body;

        if (!projectId || !integrationId) {
            return res.status(400).json({ error: 'Missing projectId or integrationId' });
        }

        const endpoint = await getOrCreateWebhookEndpoint(projectId, integrationId, events);
        
        res.json({
            success: true,
            endpoint: {
                id: endpoint.id,
                url: endpoint.url,
                secret: endpoint.secret,
                integrationId: endpoint.integrationId,
                events: endpoint.events,
                enabled: endpoint.enabled,
            },
        });
    } catch (error) {
        console.error('[Webhooks] Create endpoint error:', error);
        res.status(500).json({ error: 'Failed to create webhook endpoint' });
    }
});

/**
 * Get webhook events for a project
 * GET /api/webhooks/events/:projectId
 */
router.get('/events/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const events = await getRecentEvents(projectId, limit);
        
        res.json({
            success: true,
            events: events.map(e => ({
                id: e.id,
                integrationId: e.integrationId,
                eventType: e.eventType,
                receivedAt: e.receivedAt,
                status: e.status,
                attempts: e.attempts,
            })),
        });
    } catch (error) {
        console.error('[Webhooks] Get events error:', error);
        res.status(500).json({ error: 'Failed to get webhook events' });
    }
});

/**
 * Dynamic integration webhook receiver
 * POST /api/webhooks/:projectId/:integrationId/:secret
 *
 * This is the endpoint that integrations like Stripe call when events occur.
 * The secret is part of the URL for additional security.
 */
router.post('/:projectId/:integrationId/:secret', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
        const { projectId, integrationId, secret } = req.params;

        // Verify endpoint exists
        const endpoint = await getWebhookEndpoint(projectId, integrationId);
        
        if (!endpoint) {
            console.warn(`[Webhooks] Unknown endpoint: ${projectId}/${integrationId}`);
            return res.status(404).json({ error: 'Webhook endpoint not found' });
        }

        // Verify secret in URL
        if (endpoint.secret !== secret) {
            console.warn(`[Webhooks] Invalid secret for ${projectId}/${integrationId}`);
            return res.status(401).json({ error: 'Invalid webhook secret' });
        }

        // Verify endpoint is enabled
        if (!endpoint.enabled) {
            console.warn(`[Webhooks] Disabled endpoint: ${projectId}/${integrationId}`);
            return res.status(403).json({ error: 'Webhook endpoint disabled' });
        }

        // Get signature from integration-specific header
        const signatureHeaders: Record<string, string> = {
            stripe: 'stripe-signature',
            github: 'x-hub-signature-256',
            supabase: 'x-supabase-signature',
            clerk: 'svix-signature',
            default: 'x-webhook-signature',
        };
        const signatureHeader = signatureHeaders[integrationId] || signatureHeaders.default;
        const signature = req.headers[signatureHeader] as string;

        // Verify signature if provided
        if (signature) {
            const rawBody = JSON.stringify(req.body);
            const verification = verifySignature(integrationId, rawBody, signature, endpoint.secret);
            
            if (!verification.valid) {
                console.warn(`[Webhooks] Signature verification failed for ${integrationId}: ${verification.error}`);
                return res.status(401).json({ error: 'Invalid webhook signature' });
            }
        }

        // Parse event type from payload (integration-specific)
        let eventType = 'unknown';
        if (integrationId === 'stripe' && req.body.type) {
            eventType = req.body.type;
        } else if (integrationId === 'github' && req.headers['x-github-event']) {
            eventType = req.headers['x-github-event'] as string;
        } else if (req.body.event || req.body.eventType || req.body.type) {
            eventType = req.body.event || req.body.eventType || req.body.type;
        }

        // Store event
        const event = await storeWebhookEvent(
            endpoint.id,
            projectId,
            integrationId,
            eventType,
            req.body
        );

        // Process event asynchronously
        processWebhookEvent(event.id).catch(err => {
            console.error(`[Webhooks] Async processing failed for ${event.id}:`, err);
        });

        const duration = Date.now() - startTime;
        console.log(`[Webhooks] Received ${integrationId}:${eventType} for ${projectId} (${duration}ms)`);

        // Return success quickly
        res.status(200).json({
            received: true,
            eventId: event.id,
        });
    } catch (error) {
        console.error('[Webhooks] Integration webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
