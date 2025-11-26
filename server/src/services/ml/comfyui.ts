/**
 * ComfyUI Workflow System
 *
 * Deploy ComfyUI workflows as API endpoints:
 * - Workflow JSON parsing and validation
 * - Node dependency resolution
 * - Custom node installation
 * - GPU memory estimation
 * - Workflow-to-API endpoint generation
 */

import { CloudProvider, DeploymentConfig, GPUType } from '../cloud/types';
import { pricingCalculator } from '../cloud/pricing';

// ComfyUI Node Types
export interface ComfyUINode {
    id: string;
    type: string;
    inputs: Record<string, any>;
    outputs?: Record<string, any>;
    widgets_values?: any[];
    class_type: string;
    _meta?: {
        title?: string;
    };
}

export interface ComfyUIWorkflow {
    last_node_id: number;
    last_link_id: number;
    nodes: ComfyUINode[];
    links: Array<[number, number, number, number, number, string]>;
    groups: any[];
    config: Record<string, any>;
    extra: Record<string, any>;
    version: number;
}

export interface ComfyUIAPIFormat {
    [nodeId: string]: {
        class_type: string;
        inputs: Record<string, any>;
    };
}

export interface WorkflowRequirements {
    estimatedVRAMGB: number;
    recommendedGPU: GPUType;
    customNodes: string[];
    checkpoints: string[];
    loras: string[];
    controlnets: string[];
    vaes: string[];
    estimatedTimeSeconds: number;
    dockerBaseImage: string;
}

export interface WorkflowInput {
    name: string;
    type: 'text' | 'image' | 'number' | 'select' | 'seed';
    required: boolean;
    default?: any;
    options?: string[];
    min?: number;
    max?: number;
    nodeId: string;
    inputName: string;
}

export interface WorkflowOutput {
    name: string;
    type: 'image' | 'video' | 'text';
    nodeId: string;
}

export interface ComfyUIDeploymentConfig {
    workflow: ComfyUIWorkflow | ComfyUIAPIFormat;
    name: string;
    provider: CloudProvider;
    region: string;
    scaling?: {
        minReplicas: number;
        maxReplicas: number;
    };
    customEnv?: Record<string, string>;
}

// Known custom node repositories
const CUSTOM_NODE_REPOS: Record<string, string> = {
    'ComfyUI-Impact-Pack': 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
    'ComfyUI-Manager': 'https://github.com/ltdrdata/ComfyUI-Manager',
    'ComfyUI_IPAdapter_plus': 'https://github.com/cubiq/ComfyUI_IPAdapter_plus',
    'comfyui_controlnet_aux': 'https://github.com/Fannovel16/comfyui_controlnet_aux',
    'ComfyUI-AnimateDiff-Evolved': 'https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved',
    'ComfyUI_Comfyroll_CustomNodes': 'https://github.com/Suzie1/ComfyUI_Comfyroll_CustomNodes',
    'ComfyUI-KJNodes': 'https://github.com/kijai/ComfyUI-KJNodes',
    'ComfyUI_essentials': 'https://github.com/cubiq/ComfyUI_essentials',
    'rgthree-comfy': 'https://github.com/rgthree/rgthree-comfy',
    'was-node-suite-comfyui': 'https://github.com/WASasquatch/was-node-suite-comfyui',
};

// Node types that indicate custom nodes
const CUSTOM_NODE_INDICATORS: Record<string, string> = {
    'ImpactInt': 'ComfyUI-Impact-Pack',
    'ImpactWildcardProcessor': 'ComfyUI-Impact-Pack',
    'IPAdapterApply': 'ComfyUI_IPAdapter_plus',
    'IPAdapterModelLoader': 'ComfyUI_IPAdapter_plus',
    'ControlNetPreprocessor': 'comfyui_controlnet_aux',
    'AnimateDiffLoaderWithContext': 'ComfyUI-AnimateDiff-Evolved',
    'CR': 'ComfyUI_Comfyroll_CustomNodes',
    'KJNodes': 'ComfyUI-KJNodes',
};

/**
 * ComfyUI Service
 */
export class ComfyUIService {
    /**
     * Parse and validate a ComfyUI workflow
     */
    parseWorkflow(workflowJson: string | object): ComfyUIWorkflow | ComfyUIAPIFormat {
        const workflow = typeof workflowJson === 'string'
            ? JSON.parse(workflowJson)
            : workflowJson;

        // Detect format (UI format vs API format)
        if (workflow.nodes && Array.isArray(workflow.nodes)) {
            return workflow as ComfyUIWorkflow;
        }

        // API format
        return workflow as ComfyUIAPIFormat;
    }

    /**
     * Convert UI workflow to API format
     */
    toAPIFormat(workflow: ComfyUIWorkflow): ComfyUIAPIFormat {
        const apiFormat: ComfyUIAPIFormat = {};

        for (const node of workflow.nodes) {
            apiFormat[node.id] = {
                class_type: node.class_type || node.type,
                inputs: { ...node.inputs },
            };

            // Add widget values as inputs
            if (node.widgets_values) {
                // This requires node definition knowledge - simplified here
            }
        }

        return apiFormat;
    }

    /**
     * Analyze workflow requirements
     */
    analyzeRequirements(workflow: ComfyUIWorkflow | ComfyUIAPIFormat): WorkflowRequirements {
        const nodes = this.getNodes(workflow);

        // Detect custom nodes
        const customNodes = new Set<string>();
        const checkpoints: string[] = [];
        const loras: string[] = [];
        const controlnets: string[] = [];
        const vaes: string[] = [];

        let estimatedVRAMGB = 4; // Base ComfyUI overhead

        for (const node of nodes) {
            const nodeType = this.getNodeType(node);

            // Check for custom nodes
            for (const [indicator, pack] of Object.entries(CUSTOM_NODE_INDICATORS)) {
                if (nodeType.includes(indicator)) {
                    customNodes.add(pack);
                }
            }

            // Detect model loading nodes
            if (nodeType.includes('CheckpointLoader')) {
                const ckptName = this.getNodeInput(node, 'ckpt_name');
                if (ckptName) checkpoints.push(ckptName);
                estimatedVRAMGB += 6; // Typical SDXL checkpoint
            }

            if (nodeType.includes('LoraLoader')) {
                const loraName = this.getNodeInput(node, 'lora_name');
                if (loraName) loras.push(loraName);
                estimatedVRAMGB += 0.5;
            }

            if (nodeType.includes('ControlNetLoader')) {
                const cnName = this.getNodeInput(node, 'control_net_name');
                if (cnName) controlnets.push(cnName);
                estimatedVRAMGB += 2;
            }

            if (nodeType.includes('VAELoader')) {
                const vaeName = this.getNodeInput(node, 'vae_name');
                if (vaeName) vaes.push(vaeName);
                estimatedVRAMGB += 1;
            }

            // AnimateDiff uses more VRAM
            if (nodeType.includes('AnimateDiff')) {
                estimatedVRAMGB += 8;
            }

            // IP-Adapter
            if (nodeType.includes('IPAdapter')) {
                customNodes.add('ComfyUI_IPAdapter_plus');
                estimatedVRAMGB += 2;
            }
        }

        // Determine recommended GPU
        let recommendedGPU: GPUType = 'nvidia-rtx-4090';
        if (estimatedVRAMGB > 24) recommendedGPU = 'nvidia-a40';
        if (estimatedVRAMGB > 48) recommendedGPU = 'nvidia-a100-80gb';

        // Estimate time (very rough)
        const estimatedTimeSeconds = 10 + (checkpoints.length * 5) + (loras.length * 2);

        return {
            estimatedVRAMGB,
            recommendedGPU,
            customNodes: Array.from(customNodes),
            checkpoints,
            loras,
            controlnets,
            vaes,
            estimatedTimeSeconds,
            dockerBaseImage: 'comfyanonymous/comfyui:latest',
        };
    }

    /**
     * Extract workflow inputs (parameters user can modify)
     */
    extractInputs(workflow: ComfyUIWorkflow | ComfyUIAPIFormat): WorkflowInput[] {
        const inputs: WorkflowInput[] = [];
        const nodes = this.getNodes(workflow);

        for (const node of nodes) {
            const nodeType = this.getNodeType(node);
            const nodeId = this.getNodeId(node);

            // Text inputs (prompts)
            if (nodeType.includes('CLIPTextEncode')) {
                const text = this.getNodeInput(node, 'text');
                if (typeof text === 'string') {
                    inputs.push({
                        name: nodeType.includes('Negative') ? 'negative_prompt' : 'prompt',
                        type: 'text',
                        required: true,
                        default: text,
                        nodeId,
                        inputName: 'text',
                    });
                }
            }

            // Seed inputs
            if (nodeType.includes('KSampler')) {
                inputs.push({
                    name: 'seed',
                    type: 'seed',
                    required: false,
                    default: Math.floor(Math.random() * 1000000),
                    nodeId,
                    inputName: 'seed',
                });
            }

            // Image inputs
            if (nodeType === 'LoadImage') {
                inputs.push({
                    name: 'input_image',
                    type: 'image',
                    required: true,
                    nodeId,
                    inputName: 'image',
                });
            }

            // Numeric inputs (dimensions, steps, etc.)
            if (nodeType.includes('EmptyLatentImage')) {
                inputs.push({
                    name: 'width',
                    type: 'number',
                    required: false,
                    default: this.getNodeInput(node, 'width') || 1024,
                    min: 512,
                    max: 2048,
                    nodeId,
                    inputName: 'width',
                });
                inputs.push({
                    name: 'height',
                    type: 'number',
                    required: false,
                    default: this.getNodeInput(node, 'height') || 1024,
                    min: 512,
                    max: 2048,
                    nodeId,
                    inputName: 'height',
                });
            }
        }

        return inputs;
    }

    /**
     * Extract workflow outputs
     */
    extractOutputs(workflow: ComfyUIWorkflow | ComfyUIAPIFormat): WorkflowOutput[] {
        const outputs: WorkflowOutput[] = [];
        const nodes = this.getNodes(workflow);

        for (const node of nodes) {
            const nodeType = this.getNodeType(node);
            const nodeId = this.getNodeId(node);

            if (nodeType === 'SaveImage' || nodeType === 'PreviewImage') {
                outputs.push({
                    name: 'output_image',
                    type: 'image',
                    nodeId,
                });
            }

            if (nodeType.includes('SaveVideo') || nodeType.includes('VHS_')) {
                outputs.push({
                    name: 'output_video',
                    type: 'video',
                    nodeId,
                });
            }
        }

        return outputs;
    }

    /**
     * Generate Dockerfile for ComfyUI deployment
     */
    generateDockerfile(requirements: WorkflowRequirements): string {
        let dockerfile = `# Auto-generated ComfyUI Dockerfile
# Generated by KripTik AI

FROM ${requirements.dockerBaseImage}

WORKDIR /comfyui

# Install custom nodes
`;

        // Add custom node installations
        for (const nodePack of requirements.customNodes) {
            const repo = CUSTOM_NODE_REPOS[nodePack];
            if (repo) {
                dockerfile += `RUN cd custom_nodes && git clone ${repo}\n`;
            }
        }

        dockerfile += `
# Install custom node requirements
RUN for dir in custom_nodes/*/; do \\
    if [ -f "\${dir}requirements.txt" ]; then \\
        pip install -r "\${dir}requirements.txt"; \\
    fi; \\
done

# Copy workflow and server
COPY workflow.json /comfyui/
COPY api_server.py /comfyui/

# Install API dependencies
RUN pip install flask gunicorn pillow

# Expose ports
EXPOSE 8188
EXPOSE 8000

# Start script
COPY start.sh /comfyui/
RUN chmod +x start.sh

CMD ["/comfyui/start.sh"]
`;

        return dockerfile;
    }

    /**
     * Generate API server wrapper for ComfyUI
     */
    generateAPIServer(
        inputs: WorkflowInput[],
        outputs: WorkflowOutput[]
    ): string {
        return `"""
ComfyUI API Server
Auto-generated by KripTik AI
"""

import json
import io
import base64
import requests
from flask import Flask, request, jsonify
from PIL import Image
import time
import uuid

app = Flask(__name__)

COMFYUI_URL = "http://127.0.0.1:8188"

# Load workflow template
with open("workflow.json", "r") as f:
    WORKFLOW_TEMPLATE = json.load(f)

def queue_prompt(workflow):
    """Queue a prompt in ComfyUI"""
    response = requests.post(
        f"{COMFYUI_URL}/prompt",
        json={"prompt": workflow, "client_id": str(uuid.uuid4())}
    )
    return response.json()

def get_history(prompt_id):
    """Get generation history"""
    response = requests.get(f"{COMFYUI_URL}/history/{prompt_id}")
    return response.json()

def get_image(filename, subfolder, folder_type):
    """Get generated image"""
    response = requests.get(
        f"{COMFYUI_URL}/view",
        params={"filename": filename, "subfolder": subfolder, "type": folder_type}
    )
    return response.content

@app.route("/health", methods=["GET"])
def health():
    try:
        requests.get(f"{COMFYUI_URL}/system_stats")
        return jsonify({"status": "healthy"})
    except:
        return jsonify({"status": "starting"}), 503

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json or {}

    # Clone workflow template
    workflow = json.loads(json.dumps(WORKFLOW_TEMPLATE))

    # Apply input overrides
${inputs.map(input => `
    if "${input.name}" in data:
        workflow["${input.nodeId}"]["inputs"]["${input.inputName}"] = data["${input.name}"]
`).join('')}

    # Queue the prompt
    result = queue_prompt(workflow)
    prompt_id = result.get("prompt_id")

    if not prompt_id:
        return jsonify({"error": "Failed to queue prompt"}), 500

    # Wait for completion
    max_wait = 300  # 5 minutes
    start = time.time()

    while time.time() - start < max_wait:
        history = get_history(prompt_id)

        if prompt_id in history:
            outputs = history[prompt_id].get("outputs", {})

            # Get output images
            images = []
            for node_id, node_output in outputs.items():
                if "images" in node_output:
                    for img in node_output["images"]:
                        img_data = get_image(
                            img["filename"],
                            img.get("subfolder", ""),
                            img.get("type", "output")
                        )
                        images.append(base64.b64encode(img_data).decode())

            return jsonify({
                "images": images,
                "prompt_id": prompt_id
            })

        time.sleep(1)

    return jsonify({"error": "Generation timed out"}), 504

@app.route("/", methods=["POST"])
def inference():
    return generate()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
`;
    }

    /**
     * Generate start script
     */
    generateStartScript(): string {
        return `#!/bin/bash

# Start ComfyUI in background
python main.py --listen 0.0.0.0 --port 8188 &

# Wait for ComfyUI to start
echo "Waiting for ComfyUI to start..."
while ! curl -s http://127.0.0.1:8188/system_stats > /dev/null; do
    sleep 1
done
echo "ComfyUI started!"

# Start API server
gunicorn -w 1 -b 0.0.0.0:8000 api_server:app
`;
    }

    /**
     * Create deployment configuration
     */
    async createDeploymentConfig(config: ComfyUIDeploymentConfig): Promise<DeploymentConfig> {
        const workflow = this.parseWorkflow(config.workflow);
        const requirements = this.analyzeRequirements(workflow);

        return {
            provider: config.provider,
            resourceType: 'gpu',
            region: config.region,
            name: config.name,
            gpu: {
                type: requirements.recommendedGPU,
                count: 1,
            },
            scaling: config.scaling || {
                minReplicas: 0,
                maxReplicas: 3,
            },
            environmentVariables: config.customEnv,
            port: 8000,
            healthCheckPath: '/health',
            timeoutSeconds: 300,
            model: {
                comfyUIWorkflow: JSON.stringify(workflow),
            },
        };
    }

    /**
     * Estimate deployment cost
     */
    async estimateDeploymentCost(config: ComfyUIDeploymentConfig): Promise<{
        hourly: number;
        monthly: number;
        perGeneration: number;
    }> {
        const workflow = this.parseWorkflow(config.workflow);
        const requirements = this.analyzeRequirements(workflow);
        const deploymentConfig = await this.createDeploymentConfig(config);
        const estimate = pricingCalculator.estimateCost(deploymentConfig);

        // Estimate per-generation cost based on time
        const hoursPerGeneration = requirements.estimatedTimeSeconds / 3600;
        const perGeneration = estimate.estimatedHourlyCost * hoursPerGeneration;

        return {
            hourly: estimate.estimatedHourlyCost,
            monthly: estimate.estimatedMonthlyCost,
            perGeneration,
        };
    }

    // Helper methods

    private getNodes(workflow: ComfyUIWorkflow | ComfyUIAPIFormat): any[] {
        if ('nodes' in workflow && Array.isArray(workflow.nodes)) {
            return workflow.nodes;
        }
        return Object.entries(workflow).map(([id, node]) => ({
            id,
            ...node,
        }));
    }

    private getNodeType(node: any): string {
        return node.class_type || node.type || '';
    }

    private getNodeId(node: any): string {
        return String(node.id);
    }

    private getNodeInput(node: any, inputName: string): any {
        return node.inputs?.[inputName];
    }
}

// Singleton instance
export const comfyUIService = new ComfyUIService();

