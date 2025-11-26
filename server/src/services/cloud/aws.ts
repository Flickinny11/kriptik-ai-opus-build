/**
 * AWS Integration
 *
 * Supports Lambda, ECS/Fargate, EC2, and GPU instances
 */

import { v4 as uuidv4 } from 'uuid';
import {
    LambdaClient,
    CreateFunctionCommand,
    UpdateFunctionCodeCommand,
    GetFunctionCommand,
    DeleteFunctionCommand,
    InvokeCommand,
    ListFunctionsCommand,
} from '@aws-sdk/client-lambda';
import {
    ECSClient,
    CreateServiceCommand,
    UpdateServiceCommand,
    DeleteServiceCommand,
    DescribeServicesCommand,
    ListServicesCommand,
    RegisterTaskDefinitionCommand,
    CreateClusterCommand,
    DescribeClustersCommand,
} from '@aws-sdk/client-ecs';
import {
    EC2Client,
    RunInstancesCommand,
    TerminateInstancesCommand,
    DescribeInstancesCommand,
    StartInstancesCommand,
    StopInstancesCommand,
    _InstanceType,
} from '@aws-sdk/client-ec2';
import {
    ECRClient,
    GetAuthorizationTokenCommand,
    CreateRepositoryCommand,
    DescribeRepositoriesCommand,
} from '@aws-sdk/client-ecr';
import {
    CloudWatchLogsClient,
    GetLogEventsCommand,
    DescribeLogStreamsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
    CloudProviderInterface,
    DeploymentConfig,
    Deployment,
    DeploymentLog,
    GPUPricing,
    CostEstimate,
    DeploymentStatus,
    AWSCredentials,
} from './types';
import { pricingCalculator } from './pricing';

/**
 * AWS Cloud Provider
 */
export class AWSProvider implements CloudProviderInterface {
    readonly provider = 'aws' as const;
    private credentials: AWSCredentials;
    private lambdaClient: LambdaClient;
    private ecsClient: ECSClient;
    private ec2Client: EC2Client;
    private ecrClient: ECRClient;
    private logsClient: CloudWatchLogsClient;

    constructor(credentials: AWSCredentials) {
        this.credentials = credentials;

        const config = {
            region: credentials.region,
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                sessionToken: credentials.sessionToken,
            },
        };

        this.lambdaClient = new LambdaClient(config);
        this.ecsClient = new ECSClient(config);
        this.ec2Client = new EC2Client(config);
        this.ecrClient = new ECRClient(config);
        this.logsClient = new CloudWatchLogsClient(config);
    }

    /**
     * Validate AWS credentials
     */
    async validateCredentials(): Promise<boolean> {
        try {
            await this.ec2Client.send(new DescribeInstancesCommand({ MaxResults: 1 }));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get GPU pricing
     */
    async getGPUPricing(): Promise<GPUPricing[]> {
        return pricingCalculator.getGPUPricing('aws');
    }

    /**
     * Estimate deployment cost
     */
    async estimateCost(config: DeploymentConfig): Promise<CostEstimate> {
        return pricingCalculator.estimateCost(config);
    }

    /**
     * Deploy based on resource type
     */
    async deploy(config: DeploymentConfig): Promise<Deployment> {
        const deploymentId = uuidv4();
        const now = new Date();

        switch (config.resourceType) {
            case 'serverless':
                return this.deployLambda(deploymentId, config, now);
            case 'container':
                return this.deployECS(deploymentId, config, now);
            case 'vm':
            case 'gpu':
                return this.deployEC2(deploymentId, config, now);
            default:
                throw new Error(`Unsupported resource type: ${config.resourceType}`);
        }
    }

    /**
     * Deploy Lambda function
     */
    private async deployLambda(
        deploymentId: string,
        config: DeploymentConfig,
        now: Date
    ): Promise<Deployment> {
        const functionName = `kriptik-${config.name}-${deploymentId.slice(0, 8)}`;

        // Create Lambda function
        const response = await this.lambdaClient.send(new CreateFunctionCommand({
            FunctionName: functionName,
            Runtime: 'nodejs20.x',
            Handler: 'index.handler',
            Role: process.env.AWS_LAMBDA_ROLE_ARN || '',
            Code: {
                // In production, this would be a ZIP file or container image
                ZipFile: Buffer.from('exports.handler = async () => ({ statusCode: 200 });'),
            },
            Timeout: config.timeoutSeconds || 30,
            MemorySize: config.memoryMB || 256,
            Environment: {
                Variables: config.environmentVariables || {},
            },
        }));

        return {
            id: deploymentId,
            projectId: '',
            userId: '',
            provider: 'aws',
            config,
            status: 'running',
            providerResourceId: response.FunctionArn,
            url: `https://${this.credentials.region}.lambda-url.amazonaws.com/${functionName}`,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Deploy ECS Fargate service
     */
    private async deployECS(
        deploymentId: string,
        config: DeploymentConfig,
        now: Date
    ): Promise<Deployment> {
        const serviceName = `kriptik-${config.name}-${deploymentId.slice(0, 8)}`;
        const clusterName = 'kriptik-cluster';

        // Ensure cluster exists
        try {
            await this.ecsClient.send(new CreateClusterCommand({
                clusterName,
            }));
        } catch {
            // Cluster may already exist
        }

        // Register task definition
        const taskDef = await this.ecsClient.send(new RegisterTaskDefinitionCommand({
            family: serviceName,
            networkMode: 'awsvpc',
            requiresCompatibilities: ['FARGATE'],
            cpu: this.mapSizeToCPU(config.instanceSize),
            memory: this.mapSizeToMemory(config.instanceSize),
            containerDefinitions: [{
                name: config.name,
                image: config.containerImage || 'nginx:latest',
                portMappings: [{
                    containerPort: config.port || 80,
                    protocol: 'tcp',
                }],
                environment: Object.entries(config.environmentVariables || {}).map(([name, value]) => ({
                    name,
                    value,
                })),
                logConfiguration: {
                    logDriver: 'awslogs',
                    options: {
                        'awslogs-group': `/ecs/${serviceName}`,
                        'awslogs-region': this.credentials.region,
                        'awslogs-stream-prefix': 'ecs',
                    },
                },
            }],
        }));

        // Create service
        await this.ecsClient.send(new CreateServiceCommand({
            cluster: clusterName,
            serviceName,
            taskDefinition: taskDef.taskDefinition?.taskDefinitionArn,
            desiredCount: config.scaling?.minReplicas || 1,
            launchType: 'FARGATE',
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: [], // Would need VPC configuration
                    securityGroups: [],
                    assignPublicIp: 'ENABLED',
                },
            },
        }));

        return {
            id: deploymentId,
            projectId: '',
            userId: '',
            provider: 'aws',
            config,
            status: 'deploying',
            providerResourceId: serviceName,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Deploy EC2 instance (including GPU)
     */
    private async deployEC2(
        deploymentId: string,
        config: DeploymentConfig,
        now: Date
    ): Promise<Deployment> {
        const instanceType = config.gpu
            ? this.mapGPUToInstanceType(config.gpu.type)
            : this.mapSizeToInstanceType(config.instanceSize);

        const response = await this.ec2Client.send(new RunInstancesCommand({
            ImageId: config.gpu
                ? 'ami-0abcdef1234567890' // Deep Learning AMI
                : 'ami-0123456789abcdef0', // Amazon Linux 2
            InstanceType: instanceType as _InstanceType,
            MinCount: 1,
            MaxCount: config.scaling?.maxReplicas || 1,
            KeyName: process.env.AWS_KEY_PAIR_NAME,
            TagSpecifications: [{
                ResourceType: 'instance',
                Tags: [
                    { Key: 'Name', Value: config.name },
                    { Key: 'DeploymentId', Value: deploymentId },
                    { Key: 'ManagedBy', Value: 'kriptik-ai' },
                ],
            }],
            UserData: Buffer.from(`#!/bin/bash
# KripTik AI deployment script
${config.containerImage ? `docker pull ${config.containerImage}` : ''}
${config.containerImage ? `docker run -d -p ${config.port || 80}:${config.port || 80} ${config.containerImage}` : ''}
            `).toString('base64'),
        }));

        const instanceId = response.Instances?.[0]?.InstanceId;

        return {
            id: deploymentId,
            projectId: '',
            userId: '',
            provider: 'aws',
            config,
            status: 'deploying',
            providerResourceId: instanceId,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Get deployment status
     */
    async getDeployment(deploymentId: string): Promise<Deployment | null> {
        // Would need to query based on deployment ID tags
        return null;
    }

    /**
     * List deployments
     */
    async listDeployments(projectId?: string): Promise<Deployment[]> {
        const deployments: Deployment[] = [];

        // List Lambda functions
        const lambdas = await this.lambdaClient.send(new ListFunctionsCommand({}));
        for (const fn of lambdas.Functions || []) {
            if (fn.FunctionName?.startsWith('kriptik-')) {
                deployments.push({
                    id: fn.FunctionArn || '',
                    projectId: projectId || '',
                    userId: '',
                    provider: 'aws',
                    config: {
                        provider: 'aws',
                        resourceType: 'serverless',
                        region: this.credentials.region,
                        name: fn.FunctionName,
                    },
                    status: 'running',
                    providerResourceId: fn.FunctionArn,
                    createdAt: new Date(),
                    updatedAt: new Date(fn.LastModified || ''),
                });
            }
        }

        // List ECS services
        const clusters = await this.ecsClient.send(new DescribeClustersCommand({
            clusters: ['kriptik-cluster'],
        }));

        if (clusters.clusters?.[0]) {
            const services = await this.ecsClient.send(new ListServicesCommand({
                cluster: 'kriptik-cluster',
            }));

            for (const serviceArn of services.serviceArns || []) {
                deployments.push({
                    id: serviceArn,
                    projectId: projectId || '',
                    userId: '',
                    provider: 'aws',
                    config: {
                        provider: 'aws',
                        resourceType: 'container',
                        region: this.credentials.region,
                        name: serviceArn.split('/').pop() || '',
                    },
                    status: 'running',
                    providerResourceId: serviceArn,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
        }

        return deployments;
    }

    /**
     * Update deployment
     */
    async updateDeployment(deploymentId: string, config: Partial<DeploymentConfig>): Promise<Deployment> {
        // Implementation would depend on resource type
        throw new Error('Not implemented');
    }

    /**
     * Stop deployment
     */
    async stopDeployment(deploymentId: string): Promise<void> {
        // Try EC2 first
        try {
            await this.ec2Client.send(new StopInstancesCommand({
                InstanceIds: [deploymentId],
            }));
            return;
        } catch {
            // Not an EC2 instance
        }

        // Try ECS
        try {
            await this.ecsClient.send(new UpdateServiceCommand({
                cluster: 'kriptik-cluster',
                service: deploymentId,
                desiredCount: 0,
            }));
        } catch {
            // Not an ECS service
        }
    }

    /**
     * Delete deployment
     */
    async deleteDeployment(deploymentId: string): Promise<void> {
        // Try Lambda
        try {
            await this.lambdaClient.send(new DeleteFunctionCommand({
                FunctionName: deploymentId,
            }));
            return;
        } catch {
            // Not a Lambda
        }

        // Try ECS
        try {
            await this.ecsClient.send(new DeleteServiceCommand({
                cluster: 'kriptik-cluster',
                service: deploymentId,
                force: true,
            }));
            return;
        } catch {
            // Not an ECS service
        }

        // Try EC2
        try {
            await this.ec2Client.send(new TerminateInstancesCommand({
                InstanceIds: [deploymentId],
            }));
        } catch {
            throw new Error('Could not find deployment to delete');
        }
    }

    /**
     * Get deployment logs
     */
    async getDeploymentLogs(deploymentId: string, options?: {
        since?: Date;
        limit?: number;
    }): Promise<DeploymentLog[]> {
        try {
            // Find log streams
            const streams = await this.logsClient.send(new DescribeLogStreamsCommand({
                logGroupName: `/ecs/${deploymentId}`,
                orderBy: 'LastEventTime',
                descending: true,
                limit: 1,
            }));

            if (!streams.logStreams?.[0]?.logStreamName) {
                return [];
            }

            // Get log events
            const events = await this.logsClient.send(new GetLogEventsCommand({
                logGroupName: `/ecs/${deploymentId}`,
                logStreamName: streams.logStreams[0].logStreamName,
                startTime: options?.since?.getTime(),
                limit: options?.limit || 100,
            }));

            return (events.events || []).map(event => ({
                timestamp: new Date(event.timestamp || 0),
                level: 'info',
                message: event.message || '',
            }));
        } catch {
            return [];
        }
    }

    /**
     * Stream deployment logs
     */
    streamDeploymentLogs(deploymentId: string, callback: (log: DeploymentLog) => void): () => void {
        let isActive = true;

        const poll = async () => {
            let lastTimestamp: Date | undefined;

            while (isActive) {
                const logs = await this.getDeploymentLogs(deploymentId, {
                    since: lastTimestamp,
                    limit: 50,
                });

                for (const log of logs) {
                    callback(log);
                    lastTimestamp = log.timestamp;
                }

                await new Promise(r => setTimeout(r, 2000));
            }
        };

        poll();

        return () => {
            isActive = false;
        };
    }

    /**
     * Scale deployment
     */
    async scaleDeployment(deploymentId: string, replicas: number): Promise<void> {
        // For ECS
        await this.ecsClient.send(new UpdateServiceCommand({
            cluster: 'kriptik-cluster',
            service: deploymentId,
            desiredCount: replicas,
        }));
    }

    /**
     * Get available regions
     */
    async getAvailableRegions(): Promise<Array<{ id: string; name: string; available: boolean }>> {
        return [
            { id: 'us-east-1', name: 'US East (N. Virginia)', available: true },
            { id: 'us-east-2', name: 'US East (Ohio)', available: true },
            { id: 'us-west-1', name: 'US West (N. California)', available: true },
            { id: 'us-west-2', name: 'US West (Oregon)', available: true },
            { id: 'eu-west-1', name: 'EU (Ireland)', available: true },
            { id: 'eu-central-1', name: 'EU (Frankfurt)', available: true },
            { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', available: true },
            { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', available: true },
        ];
    }

    // Helper methods

    private mapSizeToCPU(size?: string): string {
        const mapping: Record<string, string> = {
            small: '256',
            medium: '512',
            large: '1024',
            xlarge: '2048',
        };
        return mapping[size || 'medium'] || '512';
    }

    private mapSizeToMemory(size?: string): string {
        const mapping: Record<string, string> = {
            small: '512',
            medium: '1024',
            large: '2048',
            xlarge: '4096',
        };
        return mapping[size || 'medium'] || '1024';
    }

    private mapSizeToInstanceType(size?: string): string {
        const mapping: Record<string, string> = {
            small: 't3.micro',
            medium: 't3.small',
            large: 't3.medium',
            xlarge: 't3.large',
        };
        return mapping[size || 'medium'] || 't3.small';
    }

    private mapGPUToInstanceType(gpuType: string): string {
        const mapping: Record<string, string> = {
            'nvidia-a100-40gb': 'p4d.24xlarge',
            'nvidia-a100-80gb': 'p4de.24xlarge',
            'nvidia-v100': 'p3.2xlarge',
            'nvidia-t4': 'g4dn.xlarge',
        };
        return mapping[gpuType] || 'g4dn.xlarge';
    }
}

/**
 * Create an AWS provider instance
 */
export function createAWSProvider(credentials: AWSCredentials): AWSProvider {
    return new AWSProvider(credentials);
}

