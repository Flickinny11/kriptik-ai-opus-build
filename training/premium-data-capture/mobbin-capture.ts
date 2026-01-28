/**
 * Mobbin Screenshot Capture
 *
 * Mobbin has 400,000+ app screenshots organized by:
 * - Platform: iOS, Android, Web
 * - Pattern: Onboarding, Login, Dashboard, Settings, etc.
 * - Category: Finance, Social, Productivity, Health, etc.
 *
 * Strategy: Capture app detail pages which show multiple screens
 * Target: 3,000+ unique screenshots
 *
 * Note: Mobbin requires authentication for full access.
 * This script captures publicly accessible content.
 *
 * Run with: npx tsx mobbin-capture.ts
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '../premium-designs/images/mobbin');
const CAPTION_DIR = path.join(__dirname, '../premium-designs/captions/mobbin');
const MANIFEST_PATH = path.join(__dirname, '../premium-designs/mobbin-manifest.json');

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
};

// Mobbin browse categories
const MOBBIN_CATEGORIES = [
  // iOS Apps by category
  { name: 'ios-finance', url: 'https://mobbin.com/browse/ios/apps?category=finance', platform: 'ios', category: 'finance' },
  { name: 'ios-social', url: 'https://mobbin.com/browse/ios/apps?category=social', platform: 'ios', category: 'social' },
  { name: 'ios-productivity', url: 'https://mobbin.com/browse/ios/apps?category=productivity', platform: 'ios', category: 'productivity' },
  { name: 'ios-health', url: 'https://mobbin.com/browse/ios/apps?category=health-fitness', platform: 'ios', category: 'health' },
  { name: 'ios-travel', url: 'https://mobbin.com/browse/ios/apps?category=travel', platform: 'ios', category: 'travel' },
  { name: 'ios-food', url: 'https://mobbin.com/browse/ios/apps?category=food-drink', platform: 'ios', category: 'food' },
  { name: 'ios-shopping', url: 'https://mobbin.com/browse/ios/apps?category=shopping', platform: 'ios', category: 'shopping' },
  { name: 'ios-entertainment', url: 'https://mobbin.com/browse/ios/apps?category=entertainment', platform: 'ios', category: 'entertainment' },
  { name: 'ios-education', url: 'https://mobbin.com/browse/ios/apps?category=education', platform: 'ios', category: 'education' },
  { name: 'ios-news', url: 'https://mobbin.com/browse/ios/apps?category=news', platform: 'ios', category: 'news' },

  // Android Apps
  { name: 'android-finance', url: 'https://mobbin.com/browse/android/apps?category=finance', platform: 'android', category: 'finance' },
  { name: 'android-social', url: 'https://mobbin.com/browse/android/apps?category=social', platform: 'android', category: 'social' },
  { name: 'android-productivity', url: 'https://mobbin.com/browse/android/apps?category=productivity', platform: 'android', category: 'productivity' },

  // Web Apps
  { name: 'web-saas', url: 'https://mobbin.com/browse/web/apps?category=saas', platform: 'web', category: 'saas' },
  { name: 'web-ecommerce', url: 'https://mobbin.com/browse/web/apps?category=e-commerce', platform: 'web', category: 'ecommerce' },
  { name: 'web-fintech', url: 'https://mobbin.com/browse/web/apps?category=fintech', platform: 'web', category: 'fintech' },

  // UI Patterns (most valuable for training)
  { name: 'pattern-onboarding', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=onboarding', platform: 'ios', pattern: 'onboarding' },
  { name: 'pattern-login', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=login', platform: 'ios', pattern: 'login' },
  { name: 'pattern-signup', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=sign-up', platform: 'ios', pattern: 'signup' },
  { name: 'pattern-dashboard', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=dashboard', platform: 'ios', pattern: 'dashboard' },
  { name: 'pattern-settings', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=settings', platform: 'ios', pattern: 'settings' },
  { name: 'pattern-profile', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=profile', platform: 'ios', pattern: 'profile' },
  { name: 'pattern-feed', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=feed', platform: 'ios', pattern: 'feed' },
  { name: 'pattern-search', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=search', platform: 'ios', pattern: 'search' },
  { name: 'pattern-checkout', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=checkout', platform: 'ios', pattern: 'checkout' },
  { name: 'pattern-paywall', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=paywall', platform: 'ios', pattern: 'paywall' },
  { name: 'pattern-empty-state', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=empty-state', platform: 'ios', pattern: 'empty-state' },
  { name: 'pattern-loading', url: 'https://mobbin.com/browse/ios/ui-patterns?pattern=loading', platform: 'ios', pattern: 'loading' },
];

// ============================================================================
// Mobbin Capture Service
// ============================================================================

interface CapturedScreen {
  id: string;
  appName: string;
  screenName: string;
  url: string;
  screenshot: string;
  caption: string;
  platform: 'ios' | 'android' | 'web';
  category?: string;
  pattern?: string;
  capturedAt: string;
}

class MobbinCaptureService {
  private browser: Browser | null = null;
  private results: CapturedScreen[] = [];
  private capturedUrls: Set<string> = new Set();
  private stats = {
    categoriesProcessed: 0,
    appsFound: 0,
    screensCaptured: 0,
    screensFailed: 0,
    screensSkipped: 0,
  };

  async initialize(): Promise<void> {
    console.log('[MobbinCapture] Initializing...');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    await this.loadExistingManifest();
    console.log(`[MobbinCapture] Ready. ${this.capturedUrls.size} screens already captured.`);
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async loadExistingManifest(): Promise<void> {
    try {
      if (fs.existsSync(MANIFEST_PATH)) {
        const manifest = JSON.parse(await fs.promises.readFile(MANIFEST_PATH, 'utf-8'));
        this.results = manifest.results || [];
        this.capturedUrls = new Set(this.results.map(r => r.url));
      }
    } catch {
      console.log('[MobbinCapture] No existing manifest, starting fresh');
    }
  }

  async captureAllCategories(options: {
    categoryFilter?: string[];
    maxAppsPerCategory?: number;
    maxScreensTotal?: number;
  } = {}): Promise<CapturedScreen[]> {
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.promises.mkdir(CAPTION_DIR, { recursive: true });

    const categories = options.categoryFilter
      ? MOBBIN_CATEGORIES.filter(c => options.categoryFilter!.includes(c.name))
      : MOBBIN_CATEGORIES;

    console.log(`[MobbinCapture] Processing ${categories.length} categories`);

    for (const category of categories) {
      if (options.maxScreensTotal && this.results.length >= options.maxScreensTotal) {
        console.log(`[MobbinCapture] Reached max screens limit (${options.maxScreensTotal})`);
        break;
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[${category.name.toUpperCase()}] ${category.url}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      await this.captureCategory(category, {
        maxApps: options.maxAppsPerCategory || 50,
        maxScreensRemaining: options.maxScreensTotal
          ? options.maxScreensTotal - this.results.length
          : undefined,
      });

      this.stats.categoriesProcessed++;
      await this.saveManifest();
    }

    return this.results;
  }

  private async captureCategory(
    category: typeof MOBBIN_CATEGORIES[0],
    options: { maxApps: number; maxScreensRemaining?: number }
  ): Promise<void> {
    const context = await this.browser!.newContext({
      viewport: VIEWPORTS.desktop,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const categoryDir = path.join(OUTPUT_DIR, category.name);
    const captionCategoryDir = path.join(CAPTION_DIR, category.name);
    await fs.promises.mkdir(categoryDir, { recursive: true });
    await fs.promises.mkdir(captionCategoryDir, { recursive: true });

    try {
      const page = await context.newPage();

      // Navigate to category page
      await page.goto(category.url, { waitUntil: 'networkidle', timeout: 60000 });
      await this.delay(3000);

      // Scroll to load more content
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(2000);
      }

      // Extract app/screen URLs
      const items = await page.evaluate(() => {
        const results: { url: string; name: string }[] = [];

        // Try multiple selectors for Mobbin
        const selectors = [
          'a[href*="/apps/"]',
          'a[href*="/screens/"]',
          '.app-card a',
          '.screen-card a',
          '[data-testid="app-card"] a',
        ];

        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach(el => {
            const href = el.getAttribute('href');
            const name = el.textContent?.trim() || 'Untitled';

            if (href && !results.find(r => r.url === href)) {
              results.push({
                url: href.startsWith('http') ? href : `https://mobbin.com${href}`,
                name,
              });
            }
          });
        }

        return results;
      });

      this.stats.appsFound += items.length;
      console.log(`  Found ${items.length} items`);

      // Capture each app/screen
      for (const item of items.slice(0, options.maxApps)) {
        if (options.maxScreensRemaining && this.stats.screensCaptured >= options.maxScreensRemaining) {
          break;
        }

        if (this.capturedUrls.has(item.url)) {
          console.log(`    [SKIP] Already captured: ${item.name}`);
          this.stats.screensSkipped++;
          continue;
        }

        try {
          await this.captureItem(item, category, page, categoryDir, captionCategoryDir);
          this.stats.screensCaptured++;
        } catch (error) {
          console.log(`    [FAIL] ${item.name}: ${error}`);
          this.stats.screensFailed++;
        }

        await this.delay(1500 + Math.random() * 1500);
      }

      await page.close();
    } finally {
      await context.close();
    }
  }

  private async captureItem(
    item: { url: string; name: string },
    category: typeof MOBBIN_CATEGORIES[0],
    page: Page,
    outputDir: string,
    captionDir: string
  ): Promise<void> {
    console.log(`    [CAPTURE] ${item.name}`);

    const id = this.sanitizeFilename(item.name);

    try {
      // Navigate to item page
      await page.goto(item.url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.delay(2000);

      // Capture screenshot
      const screenshotPath = path.join(outputDir, `${id}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        type: 'png',
      });

      // Generate caption
      const caption = this.generateCaption(item.name, category);
      const captionPath = path.join(captionDir, `${id}.txt`);
      await fs.promises.writeFile(captionPath, caption);

      // Record result
      const result: CapturedScreen = {
        id,
        appName: item.name,
        screenName: item.name,
        url: item.url,
        screenshot: screenshotPath,
        caption,
        platform: category.platform as 'ios' | 'android' | 'web',
        category: category.category,
        pattern: category.pattern,
        capturedAt: new Date().toISOString(),
      };

      this.results.push(result);
      this.capturedUrls.add(item.url);

    } catch (error) {
      throw error;
    }
  }

  private generateCaption(name: string, category: typeof MOBBIN_CATEGORIES[0]): string {
    const parts: string[] = ['kriptik_ui'];

    // Platform
    if (category.platform === 'ios') {
      parts.push('iOS app design');
    } else if (category.platform === 'android') {
      parts.push('Android app design');
    } else {
      parts.push('web app design');
    }

    // Category
    if (category.category) {
      parts.push(`${category.category} app`);
    }

    // Pattern (most valuable)
    if (category.pattern) {
      const patternDescriptions: Record<string, string> = {
        'onboarding': 'onboarding flow, welcome screens, feature highlights',
        'login': 'login screen, authentication UI, secure sign in',
        'signup': 'registration form, account creation, sign up flow',
        'dashboard': 'dashboard view, data visualization, metrics overview',
        'settings': 'settings page, preferences UI, configuration',
        'profile': 'user profile, account details, avatar display',
        'feed': 'content feed, timeline, scrollable list',
        'search': 'search interface, filters, results display',
        'checkout': 'checkout flow, payment UI, cart summary',
        'paywall': 'subscription paywall, pricing plans, premium features',
        'empty-state': 'empty state, placeholder, no content view',
        'loading': 'loading state, skeleton UI, progress indicator',
      };
      parts.push(patternDescriptions[category.pattern] || category.pattern);
    }

    // Standard premium vocabulary
    parts.push('mobile UI mockup');
    parts.push('modern 2026 aesthetic');
    parts.push('clean professional layout');

    return parts.join(', ');
  }

  private sanitizeFilename(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  private async saveManifest(): Promise<void> {
    const manifest = {
      lastUpdated: new Date().toISOString(),
      stats: this.stats,
      totalCaptures: this.results.length,
      byPlatform: this.results.reduce((acc, r) => {
        acc[r.platform] = (acc[r.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPattern: this.results.reduce((acc, r) => {
        if (r.pattern) acc[r.pattern] = (acc[r.pattern] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      results: this.results,
    };

    await fs.promises.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return { ...this.stats, totalCaptures: this.results.length };
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Mobbin Screenshot Capture

Captures app screenshots from Mobbin (400K+ library).
Target: 3,000+ unique screenshots.

Usage:
  npx tsx mobbin-capture.ts [options]

Options:
  --category=ios-finance,pattern-onboarding  Filter by category
  --max-apps=50         Max apps per category
  --max-screens=1000    Max total screens
  --help, -h            Show this help

Categories:
  iOS: ios-finance, ios-social, ios-productivity, ios-health, ios-travel,
       ios-food, ios-shopping, ios-entertainment, ios-education, ios-news
  Android: android-finance, android-social, android-productivity
  Web: web-saas, web-ecommerce, web-fintech
  Patterns: pattern-onboarding, pattern-login, pattern-signup, pattern-dashboard,
            pattern-settings, pattern-profile, pattern-feed, pattern-search,
            pattern-checkout, pattern-paywall, pattern-empty-state, pattern-loading

Examples:
  # Capture all categories
  npx tsx mobbin-capture.ts

  # Only iOS patterns (most valuable)
  npx tsx mobbin-capture.ts --category=pattern-onboarding,pattern-login,pattern-dashboard

  # Limit to 500 screens
  npx tsx mobbin-capture.ts --max-screens=500
`);
    return;
  }

  const categoryArg = args.find(a => a.startsWith('--category='));
  const categoryFilter = categoryArg?.replace('--category=', '').split(',');

  const maxAppsArg = args.find(a => a.startsWith('--max-apps='));
  const maxAppsPerCategory = maxAppsArg ? parseInt(maxAppsArg.replace('--max-apps=', '')) : undefined;

  const maxScreensArg = args.find(a => a.startsWith('--max-screens='));
  const maxScreensTotal = maxScreensArg ? parseInt(maxScreensArg.replace('--max-screens=', '')) : undefined;

  const service = new MobbinCaptureService();

  try {
    await service.initialize();

    const results = await service.captureAllCategories({
      categoryFilter,
      maxAppsPerCategory,
      maxScreensTotal,
    });

    const stats = service.getStats();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('MOBBIN CAPTURE COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Categories Processed: ${stats.categoriesProcessed}`);
    console.log(`  Apps Found: ${stats.appsFound}`);
    console.log(`  Screens Captured: ${stats.screensCaptured}`);
    console.log(`  Screens Failed: ${stats.screensFailed}`);
    console.log(`  Screens Skipped: ${stats.screensSkipped}`);
    console.log(`  Total in Dataset: ${stats.totalCaptures}`);
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('Capture failed:', error);
    process.exit(1);
  } finally {
    await service.cleanup();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
