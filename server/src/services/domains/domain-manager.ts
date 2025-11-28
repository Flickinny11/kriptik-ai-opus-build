/**
 * Domain Manager
 *
 * High-level domain lifecycle management:
 * - Search and purchase
 * - Connect to deployments
 * - Handle renewals
 * - Transfer out (no lock-in)
 */

import { ionosReseller } from './ionos-reseller.js';
import { db } from '../../db.js';
import { domains, domainTransactions, hostedDeployments } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
});

interface DomainPurchaseRequest {
    userId: string;
    projectId: string;
    domain: string;
    registrantInfo: {
        firstName: string;
        lastName: string;
        email: string;
        address?: string;
        city?: string;
        country?: string;
        postalCode?: string;
    };
}

export class DomainManager {

    /**
     * Search for available domains
     */
    async searchDomains(query: string, tlds?: string[]) {
        return ionosReseller.searchDomains(query, tlds);
    }

    /**
     * Create Stripe checkout for domain purchase
     */
    async createDomainCheckout(
        userId: string,
        projectId: string,
        domain: string,
        priceInCents: number,
        successUrl: string,
        cancelUrl: string
    ): Promise<{ checkoutUrl: string; sessionId: string }> {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Domain Registration: ${domain}`,
                            description: '1 year registration with auto-renewal',
                        },
                        unit_amount: priceInCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                type: 'domain_purchase',
                userId,
                projectId,
                domain,
            },
            success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
        });

        return {
            checkoutUrl: session.url!,
            sessionId: session.id,
        };
    }

    /**
     * Complete domain purchase after successful payment
     */
    async completeDomainPurchase(
        checkoutSessionId: string
    ): Promise<{ domain: string; status: string }> {
        const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

        if (session.payment_status !== 'paid') {
            throw new Error('Payment not completed');
        }

        const { userId, projectId, domain: domainName } = session.metadata!;
        const tld = domainName.split('.').pop()!;

        // Get registrant info from user profile or session
        const registrantInfo = {
            firstName: 'KripTik',
            lastName: 'User',
            email: session.customer_email || 'domains@kriptik.app',
        };

        let ionosDomainId: string | null = null;
        let ionosOrderId: string | null = null;

        // Register domain with IONOS if configured
        if (ionosReseller.isConfigured()) {
            try {
                const registration = await ionosReseller.registerDomain({
                    domain: domainName,
                    registrantContact: registrantInfo,
                    autoRenew: true,
                });
                ionosDomainId = registration.domainId;
                ionosOrderId = registration.orderId;
            } catch (error) {
                console.error('IONOS registration failed:', error);
                // Continue anyway - domain record will be marked as pending
            }
        }

        // Save domain record
        const [savedDomain] = await db.insert(domains).values({
            userId,
            projectId,
            domain: domainName,
            tld,
            registrar: ionosReseller.isConfigured() ? 'ionos' : 'pending',
            registrationStatus: ionosDomainId ? 'active' : 'pending',
            ionosDomainId,
            ionosOrderId,
            purchasePrice: session.amount_total!,
            renewalPrice: session.amount_total!,
            stripePaymentIntentId: session.payment_intent as string,
            autoRenew: true,
        }).returning();

        // Save transaction
        await db.insert(domainTransactions).values({
            userId,
            domainId: savedDomain.id,
            type: 'registration',
            amount: session.amount_total!,
            currency: 'usd',
            stripePaymentIntentId: session.payment_intent as string,
            status: 'completed',
        });

        // Connect to deployment if exists
        const [deployment] = await db
            .select()
            .from(hostedDeployments)
            .where(eq(hostedDeployments.projectId, projectId))
            .limit(1);

        if (deployment) {
            await this.connectDomainToDeployment(savedDomain.id, deployment.id);
        }

        return {
            domain: domainName,
            status: ionosDomainId ? 'active' : 'pending',
        };
    }

    /**
     * Connect a domain to a hosted deployment
     */
    async connectDomainToDeployment(
        domainId: string,
        deploymentId: string
    ): Promise<void> {
        const [domain] = await db
            .select()
            .from(domains)
            .where(eq(domains.id, domainId))
            .limit(1);

        const [deployment] = await db
            .select()
            .from(hostedDeployments)
            .where(eq(hostedDeployments.id, deploymentId))
            .limit(1);

        if (!domain || !deployment) {
            throw new Error('Domain or deployment not found');
        }

        // Configure DNS at IONOS if configured
        if (ionosReseller.isConfigured() && domain.registrar === 'ionos') {
            try {
                await ionosReseller.configureDNSForHosting(
                    domain.domain,
                    deployment.providerUrl.replace('https://', ''),
                    deployment.provider as 'cloudflare' | 'vercel'
                );
            } catch (error) {
                console.error('DNS configuration failed:', error);
            }
        }

        // Add custom domain to hosting provider
        if (deployment.provider === 'cloudflare') {
            const { cloudflarePages } = await import('../hosting/cloudflare-pages.js');
            try {
                await cloudflarePages.addCustomDomain(deployment.providerProjectName, domain.domain);
            } catch (error) {
                console.error('Cloudflare domain addition failed:', error);
            }
        } else {
            const { vercelManaged } = await import('../hosting/vercel-managed.js');
            try {
                await vercelManaged.addCustomDomain(deployment.providerProjectName, domain.domain);
            } catch (error) {
                console.error('Vercel domain addition failed:', error);
            }
        }

        // Update records
        await db
            .update(domains)
            .set({
                dnsConfigured: true,
                dnsTarget: deployment.providerUrl,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(domains.id, domainId));

        await db
            .update(hostedDeployments)
            .set({
                domainId,
                customDomain: domain.domain,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(hostedDeployments.id, deploymentId));
    }

    /**
     * Get domain transfer auth code (for no lock-in)
     */
    async getTransferCode(domainId: string, userId: string): Promise<string> {
        const [domain] = await db
            .select()
            .from(domains)
            .where(and(
                eq(domains.id, domainId),
                eq(domains.userId, userId)
            ))
            .limit(1);

        if (!domain) {
            throw new Error('Domain not found');
        }

        if (!ionosReseller.isConfigured()) {
            throw new Error('Domain transfer not available - IONOS not configured');
        }

        const authCode = await ionosReseller.getTransferAuthCode(domain.domain);

        // Update status
        await db
            .update(domains)
            .set({
                registrationStatus: 'transfer_out',
                updatedAt: new Date().toISOString(),
            })
            .where(eq(domains.id, domainId));

        return authCode;
    }

    /**
     * Get user's domains
     */
    async getUserDomains(userId: string) {
        return db
            .select()
            .from(domains)
            .where(eq(domains.userId, userId));
    }

    /**
     * Check if subdomain is available
     */
    async isSubdomainAvailable(subdomain: string): Promise<boolean> {
        const existing = await db
            .select()
            .from(hostedDeployments)
            .where(eq(hostedDeployments.subdomain, subdomain))
            .limit(1);

        return existing.length === 0;
    }

    /**
     * Reserve a subdomain for a project
     */
    async reserveSubdomain(
        projectId: string,
        userId: string,
        subdomain: string
    ): Promise<string> {
        // Validate subdomain format
        if (!/^[a-z0-9-]+$/.test(subdomain)) {
            throw new Error('Subdomain can only contain lowercase letters, numbers, and hyphens');
        }

        if (subdomain.length < 3 || subdomain.length > 63) {
            throw new Error('Subdomain must be between 3 and 63 characters');
        }

        // Check availability
        const available = await this.isSubdomainAvailable(subdomain);
        if (!available) {
            throw new Error('Subdomain is already taken');
        }

        return `${subdomain}.kriptik.app`;
    }
}

// Singleton
let instance: DomainManager | null = null;

export function getDomainManager(): DomainManager {
    if (!instance) {
        instance = new DomainManager();
    }
    return instance;
}

export const domainManager = new DomainManager();

