/**
 * Seed Demo User
 *
 * Creates a demo user for testing. Run with: npm run seed
 */

import { db } from './db';
import { users } from './schema';
import { eq } from 'drizzle-orm';

async function seedDemoUser() {
    console.log('Seeding demo user...');

    try {
        // Check if demo user exists
        const existing = await db.select()
            .from(users)
            .where(eq(users.email, 'demo@kriptik.ai'))
            .limit(1);

        if (existing.length > 0) {
            console.log('Demo user already exists');
            return;
        }

        // Create demo user
        await db.insert(users).values({
            email: 'demo@kriptik.ai',
            name: 'Demo User',
            emailVerified: true,
            credits: 1000,
        });

        console.log('✅ Demo user created successfully!');
        console.log('Email: demo@kriptik.ai');
        console.log('Note: Use OAuth or sign up to create your account');

    } catch (error) {
        console.error('Error seeding demo user:', error);
        process.exit(1);
    }
}

seedDemoUser().then(() => process.exit(0));
