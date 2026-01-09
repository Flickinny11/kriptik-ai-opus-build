/**
 * Code Samples Modal Component
 *
 * Displays code samples for connecting to an endpoint in different languages.
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CopyIcon, CheckIcon } from '@/components/ui/icons';
import type { EndpointConnection, ModelModality } from './types';

interface CodeSamplesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: EndpointConnection | null;
}

type CodeLanguage = 'python' | 'typescript' | 'curl';

const languageLabels: Record<CodeLanguage, { label: string; icon: string }> = {
  python: { label: 'Python', icon: '🐍' },
  typescript: { label: 'TypeScript', icon: '📘' },
  curl: { label: 'cURL', icon: '🔗' },
};

export function CodeSamplesModal({ open, onOpenChange, endpoint }: CodeSamplesModalProps) {
  const [activeLanguage, setActiveLanguage] = useState<CodeLanguage>('python');
  const [copied, setCopied] = useState(false);

  if (!endpoint) return null;

  const handleCopy = async () => {
    const code = endpoint.codeSamples[activeLanguage];
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Connect to</span>
            <span className="text-amber-500">{endpoint.modelName}</span>
          </DialogTitle>
          <DialogDescription>
            Use these code samples to connect your application to this endpoint.
          </DialogDescription>
        </DialogHeader>

        {/* Language Tabs */}
        <div className="flex gap-1 border-b border-white/10 pb-2">
          {(Object.keys(languageLabels) as CodeLanguage[]).map((lang) => (
            <Button
              key={lang}
              variant={activeLanguage === lang ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveLanguage(lang)}
              className={cn(
                'gap-1.5',
                activeLanguage === lang && 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              )}
            >
              <span>{languageLabels[lang].icon}</span>
              <span>{languageLabels[lang].label}</span>
            </Button>
          ))}
        </div>

        {/* Code Block */}
        <div className="relative flex-1 overflow-auto rounded-lg bg-zinc-900/80 border border-white/5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="absolute top-2 right-2 gap-1.5 text-xs opacity-60 hover:opacity-100"
          >
            {copied ? (
              <>
                <CheckIcon size={14} />
                Copied
              </>
            ) : (
              <>
                <CopyIcon size={14} />
                Copy
              </>
            )}
          </Button>

          <pre className="p-4 text-sm overflow-auto">
            <code className="text-emerald-400 font-mono whitespace-pre-wrap break-all">
              {endpoint.codeSamples[activeLanguage]}
            </code>
          </pre>
        </div>

        {/* OpenAI Compatibility Notice (for LLMs) */}
        {endpoint.modality === 'llm' && endpoint.openaiConfig && (
          <div className="mt-4 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <h4 className="text-sm font-semibold text-amber-500 mb-2">
              OpenAI SDK Compatible
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              This endpoint is compatible with the OpenAI SDK. Use these settings:
            </p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Base URL</span>
                <p className="font-mono text-white mt-1 truncate">
                  {endpoint.openaiConfig.baseUrl}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">API Key</span>
                <p className="font-mono text-white mt-1 truncate">
                  {endpoint.openaiConfig.apiKey.slice(0, 12)}...
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Model</span>
                <p className="font-mono text-white mt-1 truncate">
                  {endpoint.openaiConfig.model}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Generate code samples for an endpoint
 */
export function generateCodeSamples(
  endpointUrl: string,
  apiKey: string,
  modality: ModelModality | string,
  modelName: string
): { python: string; typescript: string; curl: string } {
  const gatewayUrl = `https://api.kriptik.app/api/v1/inference`;
  const maskedKey = `${apiKey.slice(0, 12)}...`;

  if (modality === 'llm') {
    return {
      python: `from openai import OpenAI

# KripTik API endpoint with OpenAI SDK compatibility
client = OpenAI(
    base_url="${gatewayUrl}/${endpointUrl}/",
    api_key="${maskedKey}"
)

response = client.chat.completions.create(
    model="${modelName}",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    max_tokens=256,
    temperature=0.7
)

print(response.choices[0].message.content)`,

      typescript: `import OpenAI from 'openai';

// KripTik API endpoint with OpenAI SDK compatibility
const client = new OpenAI({
  baseURL: '${gatewayUrl}/${endpointUrl}/',
  apiKey: '${maskedKey}',
});

const response = await client.chat.completions.create({
  model: '${modelName}',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
  max_tokens: 256,
  temperature: 0.7,
});

console.log(response.choices[0].message.content);`,

      curl: `curl -X POST "${gatewayUrl}/${endpointUrl}/chat/completions" \\
  -H "Authorization: Bearer ${maskedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "max_tokens": 256,
    "temperature": 0.7
  }'`,
    };
  }

  if (modality === 'image') {
    return {
      python: `import requests

response = requests.post(
    "${gatewayUrl}/${endpointUrl}",
    headers={
        "Authorization": "Bearer ${maskedKey}",
        "Content-Type": "application/json"
    },
    json={
        "prompt": "A beautiful sunset over mountains",
        "num_inference_steps": 50,
        "guidance_scale": 7.5,
        "width": 512,
        "height": 512
    }
)

# Save the generated image
with open("output.png", "wb") as f:
    f.write(response.content)`,

      typescript: `const response = await fetch('${gatewayUrl}/${endpointUrl}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${maskedKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'A beautiful sunset over mountains',
    num_inference_steps: 50,
    guidance_scale: 7.5,
    width: 512,
    height: 512,
  }),
});

const imageBlob = await response.blob();`,

      curl: `curl -X POST "${gatewayUrl}/${endpointUrl}" \\
  -H "Authorization: Bearer ${maskedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "num_inference_steps": 50,
    "guidance_scale": 7.5,
    "width": 512,
    "height": 512
  }' \\
  --output output.png`,
    };
  }

  // Generic template for audio/video/multimodal
  return {
    python: `import requests

response = requests.post(
    "${gatewayUrl}/${endpointUrl}",
    headers={
        "Authorization": "Bearer ${maskedKey}",
        "Content-Type": "application/json"
    },
    json={
        "input": "Your input here"
    }
)

result = response.json()
print(result)`,

    typescript: `const response = await fetch('${gatewayUrl}/${endpointUrl}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${maskedKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    input: 'Your input here',
  }),
});

const result = await response.json();
console.log(result);`,

    curl: `curl -X POST "${gatewayUrl}/${endpointUrl}" \\
  -H "Authorization: Bearer ${maskedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "Your input here"
  }'`,
  };
}
