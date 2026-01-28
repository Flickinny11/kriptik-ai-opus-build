/**
 * Award-Winning URL Harvester
 *
 * Scrapes thousands of premium UI URLs from:
 * - Awwwards (SOTD archives, Three.js, GSAP collections)
 * - FWA (Favourite Website Awards)
 * - CSS Design Awards
 * - CSS Nectar
 * - Codrops archive
 *
 * Target: 3,000-4,000 URLs per category for proper LoRA training
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, 'harvested-urls.json');

interface HarvestedUrl {
  title: string;
  url: string;
  source: string;
  category: string;
  tags: string[];
  harvestedAt: string;
}

interface HarvestResult {
  tier1_awards: HarvestedUrl[];
  tier2_studios: HarvestedUrl[];
  tier3_tutorials: HarvestedUrl[];
  tier4_mobile: HarvestedUrl[];
  tier5_saas: HarvestedUrl[];
  tier6_ecommerce: HarvestedUrl[];
}

// =============================================================================
// Awwwards Harvester
// =============================================================================

async function harvestAwwwards(browser: Browser): Promise<HarvestedUrl[]> {
  const urls: HarvestedUrl[] = [];
  const page = await browser.newPage();

  console.log('\n🏆 Harvesting Awwwards...');

  // Collections to scrape with pagination
  const collections = [
    { url: 'https://www.awwwards.com/websites/', name: 'SOTD', pages: 100 }, // 100 pages = ~2000 sites
    { url: 'https://www.awwwards.com/websites/three-js/', name: 'Three.js', pages: 20 },
    { url: 'https://www.awwwards.com/websites/gsap/', name: 'GSAP', pages: 20 },
    { url: 'https://www.awwwards.com/websites/webgl/', name: 'WebGL', pages: 30 },
    { url: 'https://www.awwwards.com/websites/animation/', name: 'Animation', pages: 30 },
    { url: 'https://www.awwwards.com/websites/portfolio/', name: 'Portfolio', pages: 30 },
    { url: 'https://www.awwwards.com/websites/e-commerce/', name: 'E-commerce', pages: 20 },
    { url: 'https://www.awwwards.com/websites/sites_of_the_year/', name: 'SOTY', pages: 5 },
  ];

  for (const collection of collections) {
    console.log(`   Scraping ${collection.name} (${collection.pages} pages)...`);

    for (let pageNum = 1; pageNum <= collection.pages; pageNum++) {
      try {
        const pageUrl = pageNum === 1
          ? collection.url
          : `${collection.url}?page=${pageNum}`;

        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Extract site cards - Updated selectors for 2026 Awwwards structure
        const sites = await page.evaluate(() => {
          // Primary: figure-rollover cards (main site listings)
          const cards = document.querySelectorAll('.figure-rollover, .card-collection, [class*="site-item"], [class*="box-item"]');
          return Array.from(cards).map(card => {
            // Get the main link (detail page URL)
            const linkEl = card.querySelector('a.figure-rollover__link, a[href*="/sites/"], a[href*="/websites/"]') as HTMLAnchorElement;
            // Get title from hover content or card info
            const titleEl = card.querySelector('.figure-rollover__hover h3, .card-collection__row h3, h2, h3, [class*="title"]');
            // Try to get direct site link if available
            const directLink = card.querySelector('a[href^="http"]:not([href*="awwwards"])') as HTMLAnchorElement;

            return {
              title: titleEl?.textContent?.trim() || 'Award Site',
              detailUrl: linkEl?.getAttribute('href') || '',
              siteUrl: directLink?.getAttribute('href') || '',
            };
          }).filter(s => s.detailUrl || s.siteUrl);
        });

        for (const site of sites) {
          // If we only have detail URL, we need to visit it to get actual site URL
          let finalUrl = site.siteUrl;

          if (!finalUrl && site.detailUrl) {
            try {
              const detailPage = await browser.newPage();
              const fullDetailUrl = site.detailUrl.startsWith('http')
                ? site.detailUrl
                : `https://www.awwwards.com${site.detailUrl}`;

              await detailPage.goto(fullDetailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

              finalUrl = await detailPage.evaluate(() => {
                // Try multiple selectors for the visit site button
                const visitBtn = document.querySelector(
                  'a.btn--visit, a[href^="http"][target="_blank"]:not([href*="awwwards"]):not([href*="twitter"]):not([href*="facebook"]):not([href*="linkedin"]), .site-link a'
                );
                return visitBtn?.getAttribute('href') || '';
              });

              await detailPage.close();
            } catch {
              // Skip if we can't get the URL
            }
          }

          if (finalUrl && !finalUrl.includes('awwwards.com')) {
            urls.push({
              title: site.title,
              url: finalUrl,
              source: 'awwwards',
              category: collection.name,
              tags: ['award-winning', collection.name.toLowerCase()],
              harvestedAt: new Date().toISOString(),
            });
          }
        }

        console.log(`      Page ${pageNum}: Found ${sites.length} sites (total: ${urls.length})`);

        // Rate limiting
        await page.waitForTimeout(1500);

      } catch (error) {
        console.log(`      Page ${pageNum} error: ${(error as Error).message.slice(0, 50)}`);
      }
    }
  }

  await page.close();
  console.log(`   ✅ Awwwards: ${urls.length} URLs harvested`);
  return urls;
}

// =============================================================================
// FWA Harvester
// =============================================================================

async function harvestFWA(browser: Browser): Promise<HarvestedUrl[]> {
  const urls: HarvestedUrl[] = [];
  const page = await browser.newPage();

  console.log('\n🌟 Harvesting FWA...');

  // FWA archive pages
  const categories = [
    { url: 'https://thefwa.com/cases/page/', name: 'Cases', pages: 50 },
    { url: 'https://thefwa.com/shortlist/page/', name: 'Shortlist', pages: 30 },
  ];

  for (const cat of categories) {
    console.log(`   Scraping ${cat.name}...`);

    for (let pageNum = 1; pageNum <= cat.pages; pageNum++) {
      try {
        await page.goto(`${cat.url}${pageNum}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        const sites = await page.evaluate(() => {
          const items = document.querySelectorAll('.case-item, .fwa-case, article');
          return Array.from(items).map(item => {
            const titleEl = item.querySelector('h2, h3, .title');
            const linkEl = item.querySelector('a[href*="http"]:not([href*="thefwa"])');
            return {
              title: titleEl?.textContent?.trim() || 'Unknown',
              url: linkEl?.getAttribute('href') || '',
            };
          }).filter(s => s.url);
        });

        for (const site of sites) {
          if (site.url && !site.url.includes('thefwa.com')) {
            urls.push({
              title: site.title,
              url: site.url,
              source: 'fwa',
              category: cat.name,
              tags: ['fwa', 'innovation', 'award-winning'],
              harvestedAt: new Date().toISOString(),
            });
          }
        }

        console.log(`      Page ${pageNum}: ${sites.length} sites (total: ${urls.length})`);
        await page.waitForTimeout(1500);

      } catch (error) {
        console.log(`      Page ${pageNum} error: ${(error as Error).message.slice(0, 50)}`);
      }
    }
  }

  await page.close();
  console.log(`   ✅ FWA: ${urls.length} URLs harvested`);
  return urls;
}

// =============================================================================
// CSS Design Awards Harvester
// =============================================================================

async function harvestCSSAwards(browser: Browser): Promise<HarvestedUrl[]> {
  const urls: HarvestedUrl[] = [];
  const page = await browser.newPage();

  console.log('\n🎨 Harvesting CSS Design Awards...');

  for (let pageNum = 1; pageNum <= 100; pageNum++) {
    try {
      await page.goto(`https://www.cssdesignawards.com/websites/page/${pageNum}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      const sites = await page.evaluate(() => {
        const items = document.querySelectorAll('.website-item, .site-item, article');
        return Array.from(items).map(item => {
          const titleEl = item.querySelector('h2, h3, .title');
          const linkEl = item.querySelector('a[href*="http"]:not([href*="cssdesignawards"])');
          return {
            title: titleEl?.textContent?.trim() || 'Unknown',
            url: linkEl?.getAttribute('href') || '',
          };
        }).filter(s => s.url);
      });

      for (const site of sites) {
        if (site.url && !site.url.includes('cssdesignawards.com')) {
          urls.push({
            title: site.title,
            url: site.url,
            source: 'cssdesignawards',
            category: 'WOTD',
            tags: ['css-awards', 'design', 'award-winning'],
            harvestedAt: new Date().toISOString(),
          });
        }
      }

      console.log(`   Page ${pageNum}: ${sites.length} sites (total: ${urls.length})`);
      await page.waitForTimeout(1500);

    } catch (error) {
      console.log(`   Page ${pageNum} error: ${(error as Error).message.slice(0, 50)}`);
    }
  }

  await page.close();
  console.log(`   ✅ CSS Design Awards: ${urls.length} URLs harvested`);
  return urls;
}

// =============================================================================
// Codrops Harvester
// =============================================================================

async function harvestCodrops(browser: Browser): Promise<HarvestedUrl[]> {
  const urls: HarvestedUrl[] = [];
  const page = await browser.newPage();

  console.log('\n📚 Harvesting Codrops...');

  // Codrops tags to scrape
  const tags = [
    { tag: 'webgl', pages: 20 },
    { tag: 'three-js', pages: 15 },
    { tag: 'glsl', pages: 10 },
    { tag: 'scroll', pages: 15 },
    { tag: 'animation', pages: 20 },
    { tag: 'css', pages: 25 },
    { tag: 'svg', pages: 15 },
    { tag: 'canvas', pages: 10 },
  ];

  for (const { tag, pages } of tags) {
    console.log(`   Scraping tag: ${tag}...`);

    for (let pageNum = 1; pageNum <= pages; pageNum++) {
      try {
        const url = pageNum === 1
          ? `https://tympanus.net/codrops/tag/${tag}/`
          : `https://tympanus.net/codrops/tag/${tag}/page/${pageNum}/`;

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        const articles = await page.evaluate(() => {
          const items = document.querySelectorAll('article.post, .ct-item');
          return Array.from(items).map(item => {
            const titleEl = item.querySelector('h2 a, h3 a, .ct-title a');
            const demoLink = item.querySelector('a[href*="demos"]');
            return {
              title: titleEl?.textContent?.trim() || 'Unknown',
              articleUrl: titleEl?.getAttribute('href') || '',
              demoUrl: demoLink?.getAttribute('href') || '',
            };
          });
        });

        for (const article of articles) {
          // Get the demo URL if available
          let demoUrl = article.demoUrl;

          if (!demoUrl && article.articleUrl) {
            // Visit article to find demo link
            try {
              const articlePage = await browser.newPage();
              await articlePage.goto(article.articleUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

              demoUrl = await articlePage.evaluate(() => {
                const demo = document.querySelector('a[href*="demos"], a.demo-button, a[class*="demo"]');
                return demo?.getAttribute('href') || '';
              });

              await articlePage.close();
            } catch {
              // Use article URL as fallback
              demoUrl = article.articleUrl;
            }
          }

          if (demoUrl) {
            urls.push({
              title: article.title,
              url: demoUrl,
              source: 'codrops',
              category: tag,
              tags: ['tutorial', 'demo', tag],
              harvestedAt: new Date().toISOString(),
            });
          }
        }

        console.log(`      Page ${pageNum}: ${articles.length} articles (total: ${urls.length})`);
        await page.waitForTimeout(1500);

      } catch (error) {
        console.log(`      Page ${pageNum} error: ${(error as Error).message.slice(0, 50)}`);
      }
    }
  }

  await page.close();
  console.log(`   ✅ Codrops: ${urls.length} URLs harvested`);
  return urls;
}

// =============================================================================
// Premium SaaS Sites (Curated List)
// =============================================================================

function getPremiumSaaSSites(): HarvestedUrl[] {
  const saasUrls = [
    // Design Tools
    { title: 'Figma', url: 'https://www.figma.com' },
    { title: 'Framer', url: 'https://www.framer.com' },
    { title: 'Webflow', url: 'https://webflow.com' },
    { title: 'Sketch', url: 'https://www.sketch.com' },
    { title: 'Adobe Creative Cloud', url: 'https://www.adobe.com/creativecloud.html' },
    { title: 'Canva', url: 'https://www.canva.com' },
    { title: 'InVision', url: 'https://www.invisionapp.com' },
    { title: 'Principle', url: 'https://principleformac.com' },
    { title: 'Zeplin', url: 'https://zeplin.io' },
    { title: 'Abstract', url: 'https://www.abstract.com' },

    // Productivity
    { title: 'Notion', url: 'https://www.notion.so' },
    { title: 'Linear', url: 'https://linear.app' },
    { title: 'Height', url: 'https://height.app' },
    { title: 'Cron', url: 'https://cron.com' },
    { title: 'Raycast', url: 'https://www.raycast.com' },
    { title: 'Arc Browser', url: 'https://arc.net' },
    { title: 'Craft', url: 'https://www.craft.do' },
    { title: 'Things', url: 'https://culturedcode.com/things/' },
    { title: 'Todoist', url: 'https://todoist.com' },
    { title: 'Monday.com', url: 'https://monday.com' },

    // Developer Tools
    { title: 'Vercel', url: 'https://vercel.com' },
    { title: 'Supabase', url: 'https://supabase.com' },
    { title: 'Railway', url: 'https://railway.app' },
    { title: 'Planetscale', url: 'https://planetscale.com' },
    { title: 'Neon', url: 'https://neon.tech' },
    { title: 'Render', url: 'https://render.com' },
    { title: 'Fly.io', url: 'https://fly.io' },
    { title: 'Deno', url: 'https://deno.land' },
    { title: 'Bun', url: 'https://bun.sh' },
    { title: 'Turborepo', url: 'https://turbo.build' },

    // AI/ML
    { title: 'OpenAI', url: 'https://openai.com' },
    { title: 'Anthropic', url: 'https://www.anthropic.com' },
    { title: 'Midjourney', url: 'https://www.midjourney.com' },
    { title: 'Runway', url: 'https://runwayml.com' },
    { title: 'Replicate', url: 'https://replicate.com' },
    { title: 'Hugging Face', url: 'https://huggingface.co' },
    { title: 'Jasper', url: 'https://www.jasper.ai' },
    { title: 'Copy.ai', url: 'https://www.copy.ai' },

    // Communication
    { title: 'Slack', url: 'https://slack.com' },
    { title: 'Discord', url: 'https://discord.com' },
    { title: 'Loom', url: 'https://www.loom.com' },
    { title: 'Zoom', url: 'https://zoom.us' },
    { title: 'Cal.com', url: 'https://cal.com' },
    { title: 'Calendly', url: 'https://calendly.com' },

    // Analytics & Data
    { title: 'Amplitude', url: 'https://amplitude.com' },
    { title: 'Mixpanel', url: 'https://mixpanel.com' },
    { title: 'PostHog', url: 'https://posthog.com' },
    { title: 'Segment', url: 'https://segment.com' },
    { title: 'Heap', url: 'https://heap.io' },

    // Marketing
    { title: 'Mailchimp', url: 'https://mailchimp.com' },
    { title: 'ConvertKit', url: 'https://convertkit.com' },
    { title: 'Beehiiv', url: 'https://www.beehiiv.com' },
    { title: 'HubSpot', url: 'https://www.hubspot.com' },
    { title: 'Intercom', url: 'https://www.intercom.com' },

    // Finance
    { title: 'Stripe', url: 'https://stripe.com' },
    { title: 'Mercury', url: 'https://mercury.com' },
    { title: 'Brex', url: 'https://www.brex.com' },
    { title: 'Ramp', url: 'https://ramp.com' },
    { title: 'Carta', url: 'https://carta.com' },
  ];

  return saasUrls.map(s => ({
    ...s,
    source: 'curated',
    category: 'saas',
    tags: ['saas', 'product', 'premium'],
    harvestedAt: new Date().toISOString(),
  }));
}

// =============================================================================
// Luxury E-commerce Sites (Curated List)
// =============================================================================

function getLuxuryEcommerceSites(): HarvestedUrl[] {
  const ecommerceUrls = [
    // Automotive
    { title: 'Tesla', url: 'https://www.tesla.com' },
    { title: 'Porsche', url: 'https://www.porsche.com' },
    { title: 'BMW', url: 'https://www.bmw.com' },
    { title: 'Mercedes-Benz', url: 'https://www.mercedes-benz.com' },
    { title: 'Audi', url: 'https://www.audi.com' },
    { title: 'Ferrari', url: 'https://www.ferrari.com' },
    { title: 'Lamborghini', url: 'https://www.lamborghini.com' },
    { title: 'McLaren', url: 'https://www.mclaren.com' },
    { title: 'Rolls-Royce', url: 'https://www.rolls-roycemotorcars.com' },
    { title: 'Bentley', url: 'https://www.bentleymotors.com' },

    // Fashion
    { title: 'Nike', url: 'https://www.nike.com' },
    { title: 'Adidas', url: 'https://www.adidas.com' },
    { title: 'Gucci', url: 'https://www.gucci.com' },
    { title: 'Louis Vuitton', url: 'https://www.louisvuitton.com' },
    { title: 'Chanel', url: 'https://www.chanel.com' },
    { title: 'Prada', url: 'https://www.prada.com' },
    { title: 'Balenciaga', url: 'https://www.balenciaga.com' },
    { title: 'Dior', url: 'https://www.dior.com' },
    { title: 'Hermes', url: 'https://www.hermes.com' },
    { title: 'Burberry', url: 'https://www.burberry.com' },
    { title: 'Versace', url: 'https://www.versace.com' },
    { title: 'Valentino', url: 'https://www.valentino.com' },
    { title: 'Saint Laurent', url: 'https://www.ysl.com' },
    { title: 'Bottega Veneta', url: 'https://www.bottegaveneta.com' },
    { title: 'Fendi', url: 'https://www.fendi.com' },

    // Watches & Jewelry
    { title: 'Rolex', url: 'https://www.rolex.com' },
    { title: 'Omega', url: 'https://www.omegawatches.com' },
    { title: 'Patek Philippe', url: 'https://www.patek.com' },
    { title: 'Cartier', url: 'https://www.cartier.com' },
    { title: 'Tiffany', url: 'https://www.tiffany.com' },
    { title: 'Bulgari', url: 'https://www.bulgari.com' },

    // Tech
    { title: 'Apple', url: 'https://www.apple.com' },
    { title: 'Apple Store', url: 'https://www.apple.com/shop' },
    { title: 'Apple iPhone', url: 'https://www.apple.com/iphone' },
    { title: 'Apple Mac', url: 'https://www.apple.com/mac' },
    { title: 'Apple Watch', url: 'https://www.apple.com/watch' },
    { title: 'Apple Vision Pro', url: 'https://www.apple.com/apple-vision-pro' },
    { title: 'Samsung', url: 'https://www.samsung.com' },
    { title: 'Sony', url: 'https://www.sony.com' },
    { title: 'Bang & Olufsen', url: 'https://www.bang-olufsen.com' },
    { title: 'Bose', url: 'https://www.bose.com' },
    { title: 'Dyson', url: 'https://www.dyson.com' },

    // Lifestyle
    { title: 'Airbnb', url: 'https://www.airbnb.com' },
    { title: 'VRBO', url: 'https://www.vrbo.com' },
    { title: 'Four Seasons', url: 'https://www.fourseasons.com' },
    { title: 'Ritz Carlton', url: 'https://www.ritzcarlton.com' },
    { title: 'Aman', url: 'https://www.aman.com' },

    // DTC Brands
    { title: 'Allbirds', url: 'https://www.allbirds.com' },
    { title: 'Everlane', url: 'https://www.everlane.com' },
    { title: 'Warby Parker', url: 'https://www.warbyparker.com' },
    { title: 'Away', url: 'https://www.awaytravel.com' },
    { title: 'Glossier', url: 'https://www.glossier.com' },
    { title: 'Casper', url: 'https://casper.com' },
    { title: 'Outdoor Voices', url: 'https://www.outdoorvoices.com' },
  ];

  return ecommerceUrls.map(s => ({
    ...s,
    source: 'curated',
    category: 'luxury-ecommerce',
    tags: ['ecommerce', 'luxury', 'brand'],
    harvestedAt: new Date().toISOString(),
  }));
}

// =============================================================================
// Elite Studios (Curated List with Project Pages)
// =============================================================================

function getEliteStudioUrls(): HarvestedUrl[] {
  const studioUrls = [
    // Lusion
    { title: 'Lusion', url: 'https://lusion.co' },
    { title: 'Lusion Infinite Passerella', url: 'https://passerella.lusion.co' },
    { title: 'Lusion Worldcoin Globe', url: 'https://worldcoin.org' },

    // Active Theory
    { title: 'Active Theory', url: 'https://activetheory.net' },

    // Immersive Garden
    { title: 'Immersive Garden', url: 'https://immersive-g.com' },

    // Studio Freight
    { title: 'Studio Freight', url: 'https://studiofreight.com' },
    { title: 'Darkroom', url: 'https://darkroom.engineering' },

    // Individual Portfolios
    { title: 'Bruno Simon', url: 'https://bruno-simon.com' },
    { title: 'Three.js Journey', url: 'https://threejs-journey.com' },
    { title: 'Samsy', url: 'https://samsy.ninja' },

    // Other Elite Studios
    { title: 'Akaru', url: 'https://www.akaru.fr' },
    { title: 'Area 17', url: 'https://www.area17.com' },
    { title: 'Basic Agency', url: 'https://basicagency.com' },
    { title: 'Fantasy', url: 'https://fantasy.co' },
    { title: 'North Kingdom', url: 'https://www.northkingdom.com' },
    { title: 'Tool of North America', url: 'https://www.toolofna.com' },
    { title: 'Unit9', url: 'https://www.unit9.com' },
    { title: 'Your Majesty', url: 'https://www.yourmajesty.co' },
    { title: 'HAUS', url: 'https://madeinhaus.com' },
    { title: 'Resn', url: 'https://resn.co.nz' },
    { title: 'Jam3', url: 'https://www.jam3.com' },
    { title: 'R/GA', url: 'https://www.rga.com' },
    { title: 'BUCK', url: 'https://buck.co' },
    { title: 'ManvsMachine', url: 'https://mvsm.com' },
    { title: 'Tendril', url: 'https://tendril.ca' },
    { title: 'MediaMonks', url: 'https://www.mediamonks.com' },

    // WebGL Showcase Sites
    { title: 'Moments 2024', url: 'https://moments.epic.net/2024/' },
    { title: 'NASA Eyes', url: 'https://eyes.nasa.gov' },
    { title: 'Google Earth', url: 'https://earth.google.com' },
  ];

  return studioUrls.map(s => ({
    ...s,
    source: 'curated',
    category: 'elite-studio',
    tags: ['studio', 'webgl', 'premium'],
    harvestedAt: new Date().toISOString(),
  }));
}

// =============================================================================
// Main Harvest Function
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🌐 Award-Winning URL Harvester');
  console.log('  Target: 3,000-4,000 URLs per category');
  console.log('═══════════════════════════════════════════════════════════════');

  const browser = await chromium.launch({
    headless: true,
  });

  const result: HarvestResult = {
    tier1_awards: [],
    tier2_studios: [],
    tier3_tutorials: [],
    tier4_mobile: [],
    tier5_saas: [],
    tier6_ecommerce: [],
  };

  try {
    // Harvest from award platforms
    const awwwardsUrls = await harvestAwwwards(browser);
    result.tier1_awards.push(...awwwardsUrls);

    const fwaUrls = await harvestFWA(browser);
    result.tier1_awards.push(...fwaUrls);

    const cssAwardsUrls = await harvestCSSAwards(browser);
    result.tier1_awards.push(...cssAwardsUrls);

    // Harvest tutorials
    const codropsUrls = await harvestCodrops(browser);
    result.tier3_tutorials.push(...codropsUrls);

    // Add curated lists
    result.tier2_studios.push(...getEliteStudioUrls());
    result.tier5_saas.push(...getPremiumSaaSSites());
    result.tier6_ecommerce.push(...getLuxuryEcommerceSites());

    // Deduplicate
    for (const key of Object.keys(result) as (keyof HarvestResult)[]) {
      const seen = new Set<string>();
      result[key] = result[key].filter(u => {
        if (seen.has(u.url)) return false;
        seen.add(u.url);
        return true;
      });
    }

    // Save results
    await fs.promises.writeFile(OUTPUT_FILE, JSON.stringify(result, null, 2));

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📊 HARVEST COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Tier 1 (Awards):     ${result.tier1_awards.length} URLs`);
    console.log(`  Tier 2 (Studios):    ${result.tier2_studios.length} URLs`);
    console.log(`  Tier 3 (Tutorials):  ${result.tier3_tutorials.length} URLs`);
    console.log(`  Tier 4 (Mobile):     ${result.tier4_mobile.length} URLs`);
    console.log(`  Tier 5 (SaaS):       ${result.tier5_saas.length} URLs`);
    console.log(`  Tier 6 (E-commerce): ${result.tier6_ecommerce.length} URLs`);
    console.log('───────────────────────────────────────────────────────────────');
    const total = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`  TOTAL:               ${total} URLs`);
    console.log(`  Output:              ${OUTPUT_FILE}`);
    console.log('═══════════════════════════════════════════════════════════════');

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
