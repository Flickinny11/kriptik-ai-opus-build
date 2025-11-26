# KripTik AI - Implementation Roadmap (Refined)

## Your Vision (Clarified)

You want KripTik AI to be a **seamless, production-ready AI builder** where:

1. **Users stay in KripTik** - minimal context switching to external platforms
2. **One/two-click integrations** - connect cloud providers and services effortlessly
3. **Automatic credential management** - env files populated automatically
4. **End-to-end deployment** - from prompt to running production app
5. **In user's name** - resources created belong to user, not KripTik

---

## The Realistic Solution

Since we cannot programmatically create accounts or bypass verification on third-party platforms, here's the achievable architecture:

### Architecture: "Seamless BYOK with OAuth"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        KRIPTIK AI INTEGRATION LAYER                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                   │
│  │   OAuth     │   │    BYOK     │   │   Guided    │                   │
│  │   Connect   │   │ Key Entry   │   │   Signup    │                   │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                   │
│         │                 │                 │                           │
│         └────────────┬────┴─────────────────┘                           │
│                      ▼                                                  │
│         ┌──────────────────────────┐                                    │
│         │   Credential Vault       │◀─── AES-256-GCM Encrypted         │
│         │   (Per-User Storage)     │                                    │
│         └──────────────────────────┘                                    │
│                      │                                                  │
│                      ▼                                                  │
│         ┌──────────────────────────┐                                    │
│         │   Integration Manager    │                                    │
│         │   - Validate Credentials │                                    │
│         │   - Auto-inject to .env  │                                    │
│         │   - Refresh Tokens       │                                    │
│         └──────────────────────────┘                                    │
│                      │                                                  │
│                      ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CLOUD ORCHESTRATION                          │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  RunPod    │   AWS    │   GCP    │  Vercel  │ HuggingFace │ ... │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Credential System (Week 1)

### 1.1 Credential Vault

```typescript
// server/src/services/credentials/vault.ts

export interface CredentialRecord {
    id: string;
    userId: string;
    provider: IntegrationProvider;
    credentialType: 'api_key' | 'oauth_token' | 'service_account';
    encryptedData: string;
    iv: string;
    authTag: string;
    metadata: {
        label?: string;
        scopes?: string[];
        expiresAt?: Date;
        refreshToken?: string;
    };
    validatedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Encryption using Node.js crypto
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';

export class CredentialVault {
    private masterKey: Buffer;

    async store(userId: string, provider: string, credentials: any): Promise<void>;
    async retrieve(userId: string, provider: string): Promise<any>;
    async validate(userId: string, provider: string): Promise<boolean>;
    async delete(userId: string, provider: string): Promise<void>;
    async listUserIntegrations(userId: string): Promise<IntegrationStatus[]>;
}
```

### 1.2 OAuth Flows (Where Available)

Implement OAuth 2.0 for supported platforms:

```typescript
// server/src/services/credentials/oauth/

// GitHub - Full OAuth support
export class GitHubOAuth {
    getAuthUrl(state: string): string;
    exchangeCode(code: string): Promise<{ accessToken: string; refreshToken?: string }>;
}

// Vercel - OAuth support
export class VercelOAuth {
    getAuthUrl(state: string): string;
    exchangeCode(code: string): Promise<{ accessToken: string; teamId?: string }>;
}

// Netlify - OAuth support
export class NetlifyOAuth {
    getAuthUrl(state: string): string;
    exchangeCode(code: string): Promise<{ accessToken: string }>;
}

// Google Cloud - OAuth + Service Account
export class GCPOAuth {
    getAuthUrl(state: string, scopes: string[]): string;
    exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string }>;
    // Or service account upload
    importServiceAccount(jsonKey: string): Promise<boolean>;
}
```

### 1.3 API Key Entry (BYOK)

For platforms without OAuth:

```typescript
// server/src/services/credentials/byok.ts

export class BYOKManager {
    // RunPod - API Key only
    async validateRunPodKey(apiKey: string): Promise<{ valid: boolean; userId?: string }>;

    // HuggingFace - Token
    async validateHFToken(token: string): Promise<{ valid: boolean; username?: string }>;

    // AWS - Access Keys
    async validateAWSKeys(accessKeyId: string, secretAccessKey: string): Promise<{ valid: boolean; accountId?: string }>;

    // OpenRouter - API Key
    async validateOpenRouterKey(apiKey: string): Promise<{ valid: boolean; credits?: number }>;
}
```

---

## Phase 2: Integration Marketplace UX (Week 2)

### 2.1 One-Click Connect Flow

```tsx
// src/components/integrations/OneClickConnect.tsx

export function OneClickConnect({ provider, onConnected }) {
    const { connectOAuth, enterAPIKey, status } = useIntegration(provider);

    // Determine best connection method
    const connectionMethod = getConnectionMethod(provider);

    if (connectionMethod === 'oauth') {
        return (
            <Button onClick={connectOAuth} variant="premium">
                <BrandIcon name={provider} />
                Connect with {providerName}
            </Button>
        );
    }

    if (connectionMethod === 'api_key') {
        return (
            <APIKeyDialog
                provider={provider}
                onSubmit={enterAPIKey}
                instructions={getKeyInstructions(provider)}
            />
        );
    }

    // Guided signup for new accounts
    return (
        <GuidedSignupFlow
            provider={provider}
            onComplete={onConnected}
        />
    );
}
```

### 2.2 Guided Signup Wizard

For users without accounts:

```tsx
// src/components/integrations/GuidedSignupFlow.tsx

const SIGNUP_STEPS = {
    runpod: [
        {
            title: 'Create RunPod Account',
            action: 'open_url',
            url: 'https://runpod.io/console/signup',
            instruction: 'Click the button to open RunPod signup in a new tab'
        },
        {
            title: 'Get API Key',
            action: 'open_url',
            url: 'https://runpod.io/console/user/settings',
            instruction: 'Go to Settings → API Keys → Create New Key'
        },
        {
            title: 'Enter API Key',
            action: 'input',
            inputType: 'api_key',
            instruction: 'Paste your API key here'
        }
    ],
    // Similar for other providers...
};

export function GuidedSignupFlow({ provider, onComplete }) {
    const [step, setStep] = useState(0);
    const steps = SIGNUP_STEPS[provider];

    return (
        <Wizard
            steps={steps}
            onComplete={onComplete}
        />
    );
}
```

---

## Phase 3: Smart Deployment Pipeline (Week 3-4)

### 3.1 Intelligent Resource Detection

When user requests a feature requiring cloud resources:

```typescript
// server/src/services/orchestration/resource-analyzer.ts

export interface ResourceRequirement {
    type: 'gpu' | 'cpu' | 'storage' | 'database' | 'auth' | 'cdn';
    provider: CloudProvider | 'any';
    specs?: {
        gpuMemory?: number;
        vram?: number;
        storage?: number;
        bandwidth?: number;
    };
    reason: string;
}

export class ResourceAnalyzer {
    async analyzePrompt(prompt: string): Promise<ResourceRequirement[]> {
        // Use AI to detect required resources
        const analysis = await modelRouter.generate({
            prompt: `Analyze this user request and identify required cloud resources:
            "${prompt}"

            Output JSON: { requirements: [{ type, specs, reason }] }`,
            taskType: 'planning',
        });

        return this.parseRequirements(analysis.content);
    }

    async checkUserCredentials(userId: string, requirements: ResourceRequirement[]) {
        const vault = new CredentialVault();
        const missing: string[] = [];

        for (const req of requirements) {
            const hasCredential = await vault.hasValid(userId, req.provider);
            if (!hasCredential) {
                missing.push(req.provider);
            }
        }

        return { allReady: missing.length === 0, missing };
    }
}
```

### 3.2 End-to-End Deployment

For the HunyuanWorld Voyager example:

```typescript
// server/src/services/deployment/model-deployment-pipeline.ts

export class ModelDeploymentPipeline {
    async deploy(config: {
        modelId: string;          // e.g., 'tencent/Hunyuan3D-2'
        userId: string;
        preferredProvider?: CloudProvider;
    }) {
        // 1. Fetch model info from HuggingFace
        const modelInfo = await this.hfService.getModelInfo(config.modelId);

        // 2. Determine GPU requirements
        const gpuReqs = this.calculateGPURequirements(modelInfo);

        // 3. Check user credentials
        const provider = config.preferredProvider || await this.selectProvider(config.userId, gpuReqs);
        const creds = await this.vault.retrieve(config.userId, provider);

        if (!creds) {
            throw new MissingCredentialsError(provider);
        }

        // 4. Generate optimized Dockerfile
        const dockerfile = await this.dockerBuilder.generate({
            model: modelInfo,
            quantization: this.selectQuantization(gpuReqs),
        });

        // 5. Create deployment on chosen provider
        let deployment;
        switch (provider) {
            case 'runpod':
                deployment = await this.runpod.createServerlessEndpoint({
                    name: `model-${config.modelId.replace('/', '-')}`,
                    dockerImage: dockerfile.imageName,
                    gpu: gpuReqs.recommended,
                });
                break;
            // AWS, GCP cases...
        }

        // 6. Monitor deployment status
        await this.waitForReady(deployment);

        // 7. Generate integration code
        const integrationCode = this.generateClientCode(deployment, modelInfo);

        // 8. Update project .env
        await this.updateProjectEnv(config.userId, {
            [`${provider.toUpperCase()}_ENDPOINT_URL`]: deployment.url,
            [`${provider.toUpperCase()}_ENDPOINT_ID`]: deployment.id,
        });

        return {
            deployment,
            integrationCode,
            endpointUrl: deployment.url,
        };
    }
}
```

---

## Phase 4: Real-Time Monitoring & Self-Healing (Week 5)

### 4.1 Deployment Monitor

```typescript
// server/src/services/deployment/monitor.ts

export class DeploymentMonitor {
    async watchDeployment(deploymentId: string) {
        return new Observable(subscriber => {
            const interval = setInterval(async () => {
                const status = await this.checkStatus(deploymentId);
                subscriber.next(status);

                if (status.state === 'running') {
                    clearInterval(interval);
                    subscriber.complete();
                }

                if (status.state === 'failed') {
                    clearInterval(interval);
                    subscriber.error(new DeploymentFailedError(status.error));
                }
            }, 5000);
        });
    }

    async autoHeal(deploymentId: string, error: Error) {
        // Attempt automatic recovery
        const diagnosis = await this.diagnose(error);

        if (diagnosis.fixable) {
            return await this.applyFix(deploymentId, diagnosis.fix);
        }

        throw error;
    }
}
```

---

## Phase 5: Env File Integration (Week 5-6)

### 5.1 Automatic Env Population

```typescript
// server/src/services/env-manager.ts

export class EnvManager {
    async syncProjectEnv(projectId: string, userId: string) {
        // Gather all connected integrations
        const integrations = await this.vault.listUserIntegrations(userId);

        // Build env file content
        const envVars: Record<string, string> = {};

        for (const integration of integrations) {
            const vars = await this.getProviderEnvVars(integration);
            Object.assign(envVars, vars);
        }

        // Add deployment endpoints
        const deployments = await this.getProjectDeployments(projectId);
        for (const dep of deployments) {
            envVars[`${dep.provider.toUpperCase()}_ENDPOINT`] = dep.url;
        }

        // Write to project
        await this.writeEnvFile(projectId, envVars);

        return envVars;
    }

    async getProviderEnvVars(integration: Integration): Promise<Record<string, string>> {
        // Map credentials to env var names
        const mapping = {
            openrouter: { apiKey: 'OPENROUTER_API_KEY' },
            runpod: { apiKey: 'RUNPOD_API_KEY' },
            huggingface: { token: 'HUGGINGFACE_TOKEN' },
            supabase: {
                url: 'SUPABASE_URL',
                anonKey: 'SUPABASE_ANON_KEY',
                serviceKey: 'SUPABASE_SERVICE_KEY'
            },
            // etc...
        };

        const vars: Record<string, string> = {};
        const creds = await this.vault.retrieve(integration.userId, integration.provider);
        const providerMapping = mapping[integration.provider];

        for (const [credKey, envVar] of Object.entries(providerMapping)) {
            if (creds[credKey]) {
                vars[envVar] = creds[credKey];
            }
        }

        return vars;
    }
}
```

---

## Success Metrics

After implementation, KripTik AI will achieve:

| Metric | Target |
|--------|--------|
| Time to first deployment | < 5 minutes |
| Integration connection clicks | 1-2 clicks |
| Env file population | Automatic |
| Credential security | AES-256-GCM encrypted |
| OAuth coverage | 5+ providers |
| BYOK coverage | 15+ providers |
| Self-healing success rate | > 80% |

---

## What Users Will Experience

### Before (Current State)
1. Open RunPod website → Create account → Verify email → Login → Find API settings → Create key → Copy key → Paste into KripTik → Hope it works

### After (Goal State)
1. Click "Connect RunPod" in KripTik → (If OAuth) Authorize in popup → Done
2. OR Click "Add API Key" → Follow 3-step wizard → Paste key → Validated automatically → Done

---

## Next Steps

1. **Today**: Fix login issue (run seed script)
2. **This Week**: Build CredentialVault and validation layer
3. **Next Week**: Build OneClickConnect UI components
4. **Week 3**: Integrate with deployment pipeline
5. **Week 4**: Testing and polish

Would you like me to start implementing any of these components now?

