#!/usr/bin/env npx tsx
/**
 * Qdrant Collection Setup Script
 * 
 * Creates and configures all 7 collections for the VL-JEPA semantic layer.
 * This script is idempotent - safe to run multiple times.
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
import { 
  COLLECTION_NAMES, 
  VECTOR_CONFIGS, 
  PAYLOAD_SCHEMAS,
  type CollectionName,
} from '../services/embeddings/collections.js';

// ============================================================================
// Types
// ============================================================================

interface SetupResult {
  collection: string;
  created: boolean;
  indexesCreated: number;
  error?: string;
}

interface SetupSummary {
  success: boolean;
  totalCollections: number;
  collectionsCreated: number;
  collectionsExisting: number;
  totalIndexes: number;
  errors: string[];
  duration: number;
}

// ============================================================================
// Setup Functions
// ============================================================================

async function setupCollection(
  client: QdrantClientWrapper,
  collectionName: CollectionName
): Promise<SetupResult> {
  const vectorConfig = VECTOR_CONFIGS[collectionName];
  const payloadSchema = PAYLOAD_SCHEMAS[collectionName];
  const fullName = client.getCollectionName(collectionName);
  
  const result: SetupResult = {
    collection: fullName,
    created: false,
    indexesCreated: 0,
  };

  try {
    // Check if collection exists
    const exists = await client.collectionExists(collectionName);
    
    if (!exists) {
      // Create collection
      const created = await client.createCollection(
        collectionName,
        vectorConfig.size,
        vectorConfig.distance,
        {
          onDisk: vectorConfig.onDisk,
          hnswConfig: vectorConfig.hnswConfig,
          quantizationConfig: vectorConfig.quantizationConfig ? {
            scalar: vectorConfig.quantizationConfig.scalar ? {
              type: vectorConfig.quantizationConfig.scalar.type,
              quantile: vectorConfig.quantizationConfig.scalar.quantile,
              always_ram: vectorConfig.quantizationConfig.scalar.alwaysRam,
            } : undefined,
          } : undefined,
          replicationFactor: 2,
          writeConsistencyFactor: 1,
          shardNumber: 2,
        }
      );
      
      if (!created) {
        throw new Error('Failed to create collection');
      }
      
      result.created = true;
      console.log(`  ✓ Created collection: ${fullName}`);
    } else {
      console.log(`  ○ Collection exists: ${fullName}`);
    }

    // Create payload indexes
    for (const field of payloadSchema.fields) {
      if (field.indexed) {
        const indexCreated = await client.createPayloadIndex(
          collectionName,
          field.name,
          field.type
        );
        
        if (indexCreated) {
          result.indexesCreated++;
        }
      }
    }
    
    if (result.indexesCreated > 0) {
      console.log(`    → Created ${result.indexesCreated} payload indexes`);
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ Error setting up ${fullName}:`, result.error);
  }

  return result;
}

async function verifySetup(client: QdrantClientWrapper): Promise<void> {
  console.log('\n📊 Verifying collection setup...\n');
  
  for (const collectionName of Object.values(COLLECTION_NAMES)) {
    const stats = await client.getCollectionStats(collectionName);
    
    if (stats) {
      console.log(`  ${stats.name}:`);
      console.log(`    Status: ${stats.status}`);
      console.log(`    Points: ${stats.pointsCount}`);
      console.log(`    Vectors: ${stats.vectorsCount}`);
      console.log(`    Segments: ${stats.segmentsCount}`);
    } else {
      console.log(`  ${client.getCollectionName(collectionName)}: NOT FOUND`);
    }
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
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Get Qdrant client
  const client = getQdrantClient();
  
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
  
  // Setup collections
  console.log('📦 Setting up collections...\n');
  
  const results: SetupResult[] = [];
  const collectionNames = Object.values(COLLECTION_NAMES);
  
  for (const collectionName of collectionNames) {
    const result = await setupCollection(client, collectionName);
    results.push(result);
  }
  
  // Verify setup
  await verifySetup(client);
  
  // Generate summary
  const summary: SetupSummary = {
    success: results.every(r => !r.error),
    totalCollections: collectionNames.length,
    collectionsCreated: results.filter(r => r.created).length,
    collectionsExisting: results.filter(r => !r.created && !r.error).length,
    totalIndexes: results.reduce((sum, r) => sum + r.indexesCreated, 0),
    errors: results.filter(r => r.error).map(r => `${r.collection}: ${r.error}`),
    duration: Date.now() - startTime,
  };
  
  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                          Summary                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Total Collections: ${summary.totalCollections}`);
  console.log(`  Created: ${summary.collectionsCreated}`);
  console.log(`  Already Existing: ${summary.collectionsExisting}`);
  console.log(`  Indexes Created: ${summary.totalIndexes}`);
  console.log(`  Duration: ${summary.duration}ms`);
  console.log('');
  
  if (summary.errors.length > 0) {
    console.log('❌ Errors:');
    for (const error of summary.errors) {
      console.log(`   - ${error}`);
    }
    console.log('');
    process.exit(1);
  }
  
  console.log('✅ All collections set up successfully!');
  console.log('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
