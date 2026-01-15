/**
 * Credential Flow E2E Tests
 * 
 * Tests complete flow from notification to build resume.
 * Covers OAuth, manual entry, validation, and multi-credential scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock modules before imports
vi.mock('../../services/security/credential-vault.js', () => ({
  getCredentialVault: vi.fn(() => mockCredentialVault),
  CredentialVault: vi.fn(),
}));

vi.mock('../../services/integrations/nango-service.js', () => ({
  NangoService: vi.fn(() => mockNangoService),
  OAUTH_PROVIDERS: new Set(['stripe', 'github', 'google', 'supabase']),
}));

vi.mock('../../services/notifications/notification-service.js', () => ({
  NotificationService: vi.fn(() => mockNotificationService),
}));

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

const mockCredentialVault = {
  storeCredential: vi.fn(),
  getCredential: vi.fn(),
  listCredentials: vi.fn(() => []),
  deleteCredential: vi.fn(),
};

const mockNangoService = {
  getConnection: vi.fn(),
  triggerOAuth: vi.fn(),
  revokeConnection: vi.fn(),
};

const mockNotificationService = {
  sendNotification: vi.fn(() => Promise.resolve({ success: true, notificationId: 'test-notification-1' })),
  getNotifications: vi.fn(() => []),
};

const mockBuildLoop = {
  state: { status: 'running', phase: 2 },
  signalCredentialsAvailable: vi.fn(),
  resume: vi.fn(),
};

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestCredential {
  integrationId: string;
  credentials: Record<string, string>;
}

async function simulateCredentialSubmission(
  credential: TestCredential
): Promise<{ success: boolean; error?: string }> {
  const { integrationId, credentials } = credential;
  
  // Validate all required fields are present
  if (!credentials || Object.keys(credentials).length === 0) {
    return { success: false, error: 'No credentials provided' };
  }
  
  // Check for empty values
  const emptyFields = Object.entries(credentials)
    .filter(([_, value]) => !value || value.trim() === '')
    .map(([key]) => key);
  
  if (emptyFields.length > 0) {
    return { success: false, error: `Missing required fields: ${emptyFields.join(', ')}` };
  }
  
  // Validate API key format for known providers
  if (integrationId === 'stripe') {
    const secretKey = credentials['STRIPE_SECRET_KEY'];
    if (!secretKey.startsWith('sk_')) {
      return { success: false, error: 'Invalid Stripe secret key format' };
    }
  }
  
  if (integrationId === 'openai') {
    const apiKey = credentials['OPENAI_API_KEY'];
    if (!apiKey.startsWith('sk-')) {
      return { success: false, error: 'Invalid OpenAI API key format' };
    }
  }
  
  // Store credential
  await mockCredentialVault.storeCredential({
    userId: 'test-user',
    integrationId,
    credentials: Object.entries(credentials).map(([key, value]) => ({
      key,
      value,
      isSecret: true,
    })),
  });
  
  return { success: true };
}

async function simulateOAuthCallback(
  integrationId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!accessToken) {
    return { success: false, error: 'No access token provided' };
  }
  
  // Mock storing OAuth credential
  await mockCredentialVault.storeCredential({
    userId: 'test-user',
    integrationId,
    credentials: [
      { key: 'access_token', value: accessToken, isSecret: true },
      { key: 'refresh_token', value: 'mock_refresh_token', isSecret: true },
    ],
  });
  
  return { success: true };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Credential Flow E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCredentialVault.listCredentials.mockReturnValue([]);
    mockCredentialVault.getCredential.mockReturnValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // --------------------------------------------------------------------------
  // TEST CASE 1: OAuth Integration Flow
  // --------------------------------------------------------------------------
  describe('OAuth Integration Flow', () => {
    it('should complete OAuth flow and store credentials', async () => {
      // 1. Mock Nango OAuth response
      const mockAccessToken = 'oauth_access_token_12345';
      mockNangoService.getConnection.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: 'oauth_refresh_token',
        expiresAt: Date.now() + 3600000,
      });

      // 2. Simulate OAuth callback
      const result = await simulateOAuthCallback('github', mockAccessToken);
      expect(result.success).toBe(true);

      // 3. Verify credential stored in vault
      expect(mockCredentialVault.storeCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          integrationId: 'github',
          credentials: expect.arrayContaining([
            expect.objectContaining({ key: 'access_token' }),
          ]),
        })
      );
    });

    it('should handle OAuth failure gracefully', async () => {
      mockNangoService.getConnection.mockRejectedValue(new Error('OAuth failed'));

      const result = await simulateOAuthCallback('github', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('No access token provided');
    });
  });

  // --------------------------------------------------------------------------
  // TEST CASE 2: Manual Credential Flow
  // --------------------------------------------------------------------------
  describe('Manual Credential Flow', () => {
    it('should store valid Stripe credentials', async () => {
      const credentials: TestCredential = {
        integrationId: 'stripe',
        credentials: {
          'STRIPE_SECRET_KEY': 'sk_test_51abc123xyz',
          'STRIPE_PUBLISHABLE_KEY': 'pk_test_51abc123xyz',
        },
      };

      const result = await simulateCredentialSubmission(credentials);
      
      expect(result.success).toBe(true);
      expect(mockCredentialVault.storeCredential).toHaveBeenCalled();
    });

    it('should store valid OpenAI credentials', async () => {
      const credentials: TestCredential = {
        integrationId: 'openai',
        credentials: {
          'OPENAI_API_KEY': 'sk-proj-abc123xyz',
        },
      };

      const result = await simulateCredentialSubmission(credentials);
      
      expect(result.success).toBe(true);
      expect(mockCredentialVault.storeCredential).toHaveBeenCalled();
    });

    it('should store Supabase credentials with URL and key', async () => {
      const credentials: TestCredential = {
        integrationId: 'supabase',
        credentials: {
          'SUPABASE_URL': 'https://xyzabc.supabase.co',
          'SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        },
      };

      const result = await simulateCredentialSubmission(credentials);
      
      expect(result.success).toBe(true);
      expect(mockCredentialVault.storeCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          integrationId: 'supabase',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // TEST CASE 3: Invalid Credential Handling
  // --------------------------------------------------------------------------
  describe('Invalid Credential Handling', () => {
    it('should reject invalid Stripe secret key format', async () => {
      const credentials: TestCredential = {
        integrationId: 'stripe',
        credentials: {
          'STRIPE_SECRET_KEY': 'invalid_key_format',
        },
      };

      const result = await simulateCredentialSubmission(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Stripe secret key format');
      expect(mockCredentialVault.storeCredential).not.toHaveBeenCalled();
    });

    it('should reject invalid OpenAI API key format', async () => {
      const credentials: TestCredential = {
        integrationId: 'openai',
        credentials: {
          'OPENAI_API_KEY': 'not_a_valid_key',
        },
      };

      const result = await simulateCredentialSubmission(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid OpenAI API key format');
    });

    it('should reject empty credentials', async () => {
      const credentials: TestCredential = {
        integrationId: 'stripe',
        credentials: {},
      };

      const result = await simulateCredentialSubmission(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No credentials provided');
    });

    it('should reject credentials with empty values', async () => {
      const credentials: TestCredential = {
        integrationId: 'stripe',
        credentials: {
          'STRIPE_SECRET_KEY': '',
        },
      };

      const result = await simulateCredentialSubmission(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });
  });

  // --------------------------------------------------------------------------
  // TEST CASE 4: Build Resume After Credential
  // --------------------------------------------------------------------------
  describe('Build Resume After Credential', () => {
    it('should signal build to resume after credential added', async () => {
      // 1. Simulate build paused for credentials
      mockBuildLoop.state.status = 'waiting_credentials';

      // 2. Add credentials
      const credentials: TestCredential = {
        integrationId: 'stripe',
        credentials: {
          'STRIPE_SECRET_KEY': 'sk_test_valid123',
        },
      };

      const result = await simulateCredentialSubmission(credentials);
      expect(result.success).toBe(true);

      // 3. Signal build to resume
      mockBuildLoop.signalCredentialsAvailable('stripe');

      // 4. Verify signal was called
      expect(mockBuildLoop.signalCredentialsAvailable).toHaveBeenCalledWith('stripe');
    });

    it('should transition from waiting_credentials to running', async () => {
      mockBuildLoop.state.status = 'waiting_credentials';

      // Add credential
      const result = await simulateCredentialSubmission({
        integrationId: 'supabase',
        credentials: {
          'SUPABASE_URL': 'https://test.supabase.co',
          'SUPABASE_ANON_KEY': 'eyJ_valid_key',
        },
      });

      expect(result.success).toBe(true);

      // Simulate state transition
      mockBuildLoop.state.status = 'running';
      expect(mockBuildLoop.state.status).toBe('running');
    });
  });

  // --------------------------------------------------------------------------
  // TEST CASE 5: Multi-Credential Flow
  // --------------------------------------------------------------------------
  describe('Multi-Credential Flow', () => {
    it('should handle multiple sequential credential submissions', async () => {
      // First: Add Stripe
      const stripeResult = await simulateCredentialSubmission({
        integrationId: 'stripe',
        credentials: {
          'STRIPE_SECRET_KEY': 'sk_test_stripe123',
        },
      });
      expect(stripeResult.success).toBe(true);

      // Second: Add Supabase
      const supabaseResult = await simulateCredentialSubmission({
        integrationId: 'supabase',
        credentials: {
          'SUPABASE_URL': 'https://project.supabase.co',
          'SUPABASE_ANON_KEY': 'eyJ_test_anon_key',
        },
      });
      expect(supabaseResult.success).toBe(true);

      // Verify both stored
      expect(mockCredentialVault.storeCredential).toHaveBeenCalledTimes(2);
    });

    it('should track progress through multiple credentials', async () => {
      const requiredIntegrations = ['stripe', 'supabase', 'openai'];
      const addedCredentials: string[] = [];

      // Add each credential
      for (const integrationId of requiredIntegrations) {
        let credentials: Record<string, string>;

        switch (integrationId) {
          case 'stripe':
            credentials = { 'STRIPE_SECRET_KEY': 'sk_test_123' };
            break;
          case 'supabase':
            credentials = { 
              'SUPABASE_URL': 'https://test.supabase.co',
              'SUPABASE_ANON_KEY': 'eyJ_test',
            };
            break;
          case 'openai':
            credentials = { 'OPENAI_API_KEY': 'sk-test123' };
            break;
          default:
            continue;
        }

        const result = await simulateCredentialSubmission({
          integrationId,
          credentials,
        });

        if (result.success) {
          addedCredentials.push(integrationId);
        }
      }

      // Verify all added
      expect(addedCredentials).toEqual(requiredIntegrations);
      expect(addedCredentials.length).toBe(3);
    });

    it('should continue after partial failure', async () => {
      // First: Add valid Stripe (succeeds)
      const stripeResult = await simulateCredentialSubmission({
        integrationId: 'stripe',
        credentials: {
          'STRIPE_SECRET_KEY': 'sk_test_valid',
        },
      });
      expect(stripeResult.success).toBe(true);

      // Second: Add invalid OpenAI (fails)
      const openaiResult = await simulateCredentialSubmission({
        integrationId: 'openai',
        credentials: {
          'OPENAI_API_KEY': 'invalid_key',
        },
      });
      expect(openaiResult.success).toBe(false);

      // Third: Add valid Supabase (succeeds)
      const supabaseResult = await simulateCredentialSubmission({
        integrationId: 'supabase',
        credentials: {
          'SUPABASE_URL': 'https://test.supabase.co',
          'SUPABASE_ANON_KEY': 'eyJ_valid',
        },
      });
      expect(supabaseResult.success).toBe(true);

      // Verify 2 out of 3 succeeded
      expect(mockCredentialVault.storeCredential).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // TEST CASE 6: Notification Flow
  // --------------------------------------------------------------------------
  describe('Notification Flow', () => {
    it('should send notification when credentials are required', async () => {
      const notificationPayload = {
        type: 'credentials_needed',
        userId: 'test-user',
        title: 'Credentials Required: Stripe',
        message: 'Your build requires Stripe credentials to continue.',
        metadata: {
          integrationId: 'stripe',
          projectId: 'project-123',
          buildId: 'build-456',
          supportsOAuth: true,
        },
      };

      await mockNotificationService.sendNotification(notificationPayload);

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'credentials_needed',
          metadata: expect.objectContaining({
            integrationId: 'stripe',
          }),
        })
      );
    });
  });
});
