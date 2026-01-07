#!/usr/bin/env npx tsx
/**
 * Qdrant Collection Setup Script (Enhanced)
 *
 * Creates and configures all 7 collections for the VL-JEPA semantic layer.
 * This script is idempotent - safe to run multiple times.
 *
 * Features:
 * - Creates all collections with proper configurations
 * - Sets up payload indexes for filtering
 * - Configures HNSW and quantization settings
 * - Verifies setup with statistics
 * - Supports tiered multitenancy
 *
 * Usage:
 *   npm run setup:qdrant
 *   npx tsx src/scripts/setup-qdrant-collections.ts
 *
 * Environment:
 *   QDRANT_URL - Qdrant server URL (default: http://localhost:6333)
 *   QDRANT_API_KEY - Optional API key
 *   QDRANT_COLLECTION_PREFIX - Collection name prefix (default: kriptik_)
 */

import { config } from 'dotenv';
config();

import { getQdrantClient, type QdrantClientWrapper } from '../services/embeddings/qdrant-client.js';
import { getCollectionManager } from '../services/embeddings/collection-manager.js';
import { getMultitenancyManager } from '../services/embeddings/multitenancy-manager.js';
import { COLLECTION_NAMES, VECTOR_CONFIGS, PAYLOAD_SCHEMAS } from '../services/embeddings/collections.js';

// ============================================================================
// Types
// ============================================================================

interface SetupSummary {
  success: boolean;
  totalCollections: number;
  collectionsCreated: number;
  collectionsExisting: number;
  totalIndexes: number;
  errors: string[];
  duration: number;
  collectionDetails: Array<{
    name: string;
    vectorSize: number;
    pointsCount: number;
    indexes: string[];
    status: string;
  }>;
}

// ============================================================================
// Setup Functions
// ============================================================================

async function verifySetup(client: QdrantClientWrapper): Promise<SetupSummary['collectionDetails']> {
  console.log('\n📊 Verifying collection setup...\n');

  const details: SetupSummary['collectionDetails'] = [];

  for (const collectionName of Object.values(COLLECTION_NAMES)) {
    const stats = await client.getCollectionStats(collectionName);
    const vectorConfig = VECTOR_CONFIGS[collectionName];
    const payloadSchema = PAYLOAD_SCHEMAS[collectionName];
    const indexes = payloadSchema.fields.filter(f => f.indexed).map(f => f.name);

    if (stats) {
      console.log(`  ${stats.name}:`);
      console.log(`    Status: ${stats.status}`);
      console.log(`    Vector Size: ${vectorConfig.size} dimensions`);
      console.log(`    Points: ${stats.pointsCount}`);
      console.log(`    Segments: ${stats.segmentsCount}`);
      console.log(`    Indexes: ${indexes.join(', ')}`);

      details.push({
        name: collectionName,
        vectorSize: vectorConfig.size,
        pointsCount: stats.pointsCount,
        indexes,
        status: stats.status,
      });
    } else {
      console.log(`  ${client.getCollectionName(collectionName)}: NOT FOUND`);
      details.push({
        name: collectionName,
        vectorSize: vectorConfig.size,
        pointsCount: 0,
        indexes: [],
        status: 'missing',
      });
    }
  }

  return details;
}

async function printCollectionConfigurations(): Promise<void> {
  console.log('\n📋 Collection Configurations:\n');

  for (const [name, config] of Object.entries(VECTOR_CONFIGS)) {
    console.log(`  ${name}:`);
    console.log(`    Dimensions: ${config.size}`);
    console.log(`    Distance: ${config.distance}`);
    if (config.hnswConfig) {
      console.log(`    HNSW m=${config.hnswConfig.m}, ef_construct=${config.hnswConfig.efConstruct}`);
    }
    if (config.quantizationConfig?.scalar) {
      console.log(`    Quantization: ${config.quantizationConfig.scalar.type}`);
    }
    console.log('');
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          KripTik AI - Qdrant Collection Setup                  ║');
  console.log('║          VL-JEPA Semantic Intelligence Layer                   ║');
  console.log('║          Version 2.0 - With Multitenancy Support               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Get managers
  const client = getQdrantClient();
  const collectionManager = getCollectionManager();
  const multitenancyManager = getMultitenancyManager();

  // Check health
  console.log('🔌 Connecting to Qdrant...\n');
  const health = await client.healthCheck();

  if (!health.healthy) {
    console.error('❌ Failed to connect to Qdrant:', health.error);
    console.error('');
    console.error('Make sure Qdrant is running:');
    console.error('  npm run qdrant:start');
    console.error('');
    process.exit(1);
  }

  console.log(`  ✓ Connected to Qdrant (${health.responseTimeMs}ms)`);
  console.log(`  ✓ Version: ${health.version}`);
  console.log(`  ✓ Existing collections: ${health.collectionsCount}`);
  console.log('');

  // Print collection configurations
  await printCollectionConfigurations();

  // Initialize all collections using CollectionManager
  console.log('📦 Initializing collections...\n');

  const initResult = await collectionManager.initialize();

  if (initResult.created.length > 0) {
    console.log(`  ✓ Created ${initResult.created.length} new collections:`);
    for (const name of initResult.created) {
      console.log(`    - ${name}`);
    }
  }

  if (initResult.existing.length > 0) {
    console.log(`  ○ ${initResult.existing.length} collections already exist:`);
    for (const name of initResult.existing) {
      console.log(`    - ${name}`);
    }
  }

  if (initResult.errors.length > 0) {
    console.log(`  ✗ ${initResult.errors.length} errors:`);
    for (const error of initResult.errors) {
      console.log(`    - ${error}`);
    }
  }

  // Verify setup
  const collectionDetails = await verifySetup(client);

  // Initialize multitenancy (just create the manager, don't start monitoring)
  console.log('\n🏢 Multitenancy Configuration:');
  const mtConfig = multitenancyManager.getConfig();
  console.log(`  Promotion Threshold: ${mtConfig.promotionThreshold.toLocaleString()} vectors`);
  console.log(`  Demotion Threshold: ${mtConfig.demotionThreshold.toLocaleString()} vectors`);
  console.log(`  Auto-Promote Enabled: ${mtConfig.autoPromoteEnabled}`);
  console.log(`  Off-Peak Hours: ${mtConfig.offPeakHoursStart}:00 - ${mtConfig.offPeakHoursEnd}:00`);

  // Generate summary
  const totalIndexes = collectionDetails.reduce(
    (sum, c) => sum + c.indexes.length,
    0
  );

  const summary: SetupSummary = {
    success: initResult.errors.length === 0,
    totalCollections: Object.keys(COLLECTION_NAMES).length,
    collectionsCreated: initResult.created.length,
    collectionsExisting: initResult.existing.length,
    totalIndexes,
    errors: initResult.errors,
    duration: Date.now() - startTime,
    collectionDetails,
  };

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                          Summary                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Total Collections: ${summary.totalCollections}`);
  console.log(`  Created: ${summary.collectionsCreated}`);
  console.log(`  Already Existing: ${summary.collectionsExisting}`);
  console.log(`  Total Indexes: ${summary.totalIndexes}`);
  console.log(`  Duration: ${summary.duration}ms`);
  console.log('');

  // Collection overview table
  console.log('  Collection Overview:');
  console.log('  ────────────────────────────────────────────────────────────────');
  console.log('  Collection              │ Vectors │ Dims  │ Status');
  console.log('  ────────────────────────────────────────────────────────────────');

  for (const col of collectionDetails) {
    const name = col.name.padEnd(22);
    const vectors = String(col.vectorSize).padStart(7);
    const points = String(col.pointsCount).padStart(5);
    console.log(`  ${name} │ ${vectors} │ ${points} │ ${col.status}`);
  }

  console.log('  ────────────────────────────────────────────────────────────────');
  console.log('');

  if (summary.errors.length > 0) {
    console.log('❌ Setup completed with errors:');
    for (const error of summary.errors) {
      console.log(`   - ${error}`);
    }
    console.log('');
    process.exit(1);
  }

  console.log('✅ All collections set up successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Configure embedding API keys (HUGGINGFACE_API_KEY, VOYAGE_API_KEY)');
  console.log('  2. Start using the embedding service via /api/embeddings endpoints');
  console.log('  3. Monitor collection health via /api/health/qdrant/collections');
  console.log('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
