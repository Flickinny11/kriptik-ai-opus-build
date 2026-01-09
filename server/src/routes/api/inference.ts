/**
 * Inference API Routes
 *
 * API endpoints for inference requests to private endpoints.
 * Proxies to RunPod/Modal through the InferenceGateway.
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature.
 */

import { Router, Request, Response } from 'express';
import { getInferenceGateway, getStatusCode } from '../../services/gateway/inference-gateway.js';

const router = Router();

// =============================================================================
// INFERENCE ROUTES
// =============================================================================

/**
 * POST /api/v1/inference/:endpointId
 * Process an inference request
 */
router.post('/:endpointId', async (req: Request, res: Response) => {
  const { endpointId } = req.params;
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '') || '';
  const isStream = req.headers.accept === 'text/event-stream';

  const gateway = getInferenceGateway();

  try {
    if (isStream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      const generator = gateway.processStreamingRequest({
        endpointId,
        apiKey,
        body: req.body,
        stream: true,
      });

      for await (const chunk of generator) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Regular response
      const response = await gateway.processRequest({
        endpointId,
        apiKey,
        body: req.body,
      });

      if (response.success) {
        res.json(response.data);
      } else {
        const statusCode = getStatusCode(response.error?.code || 'INTERNAL_ERROR');
        res.status(statusCode).json(response.error);
      }
    }
  } catch (error) {
    console.error('[InferenceRoutes] Error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/v1/inference/:endpointId/chat/completions
 * OpenAI-compatible chat completions endpoint
 */
router.post('/:endpointId/chat/completions', async (req: Request, res: Response) => {
  const { endpointId } = req.params;
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '') || '';
  const isStream = req.body.stream === true;

  const gateway = getInferenceGateway();

  try {
    if (isStream) {
      // Streaming response (OpenAI SSE format)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const generator = gateway.processStreamingRequest({
        endpointId,
        apiKey,
        body: req.body,
        stream: true,
      });

      for await (const chunk of generator) {
        // Format as OpenAI SSE
        if ((chunk as Record<string, unknown>).error) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        } else {
          // Transform to OpenAI chat completion chunk format
          const openaiChunk = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: req.body.model || 'custom-model',
            choices: [
              {
                index: 0,
                delta: chunk,
                finish_reason: null,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Regular response
      const response = await gateway.processRequest({
        endpointId,
        apiKey,
        body: req.body,
      });

      if (response.success) {
        // Transform to OpenAI response format if needed
        const data = response.data as Record<string, unknown>;
        if (!data.object) {
          // Extract message from various response formats
          let message: { role: string; content: string } = { role: 'assistant', content: '' };
          
          if (data.message && typeof data.message === 'object') {
            message = data.message as { role: string; content: string };
          } else if (Array.isArray(data.choices) && data.choices.length > 0) {
            const firstChoice = data.choices[0] as { message?: { role: string; content: string } };
            if (firstChoice.message) {
              message = firstChoice.message;
            }
          } else if (typeof data === 'string') {
            message = { role: 'assistant', content: data };
          } else {
            message = { role: 'assistant', content: JSON.stringify(data) };
          }
          
          // Wrap in OpenAI format
          const openaiResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: req.body.model || 'custom-model',
            choices: [
              {
                index: 0,
                message,
                finish_reason: 'stop',
              },
            ],
            usage: response.usage ? {
              prompt_tokens: response.usage.inputTokens,
              completion_tokens: response.usage.outputTokens,
              total_tokens: response.usage.inputTokens + response.usage.outputTokens,
            } : undefined,
          };
          res.json(openaiResponse);
        } else {
          res.json(data);
        }
      } else {
        const statusCode = getStatusCode(response.error?.code || 'INTERNAL_ERROR');
        res.status(statusCode).json({
          error: {
            message: response.error?.message,
            type: response.error?.code,
            code: response.error?.code,
          },
        });
      }
    }
  } catch (error) {
    console.error('[InferenceRoutes] Chat completions error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'internal_error',
        code: 'internal_error',
      },
    });
  }
});

/**
 * GET /api/v1/inference/:endpointId/status
 * Get endpoint status
 */
router.get('/:endpointId/status', async (req: Request, res: Response) => {
  const { endpointId } = req.params;
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '') || '';

  const gateway = getInferenceGateway();

  try {
    const status = await gateway.getEndpointStatus(endpointId, apiKey);
    res.json(status);
  } catch (error) {
    res.status(401).json({
      code: 'INVALID_API_KEY',
      message: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
});

/**
 * GET /api/v1/inference/:endpointId/models
 * List available models (OpenAI-compatible)
 */
router.get('/:endpointId/models', async (req: Request, res: Response) => {
  const { endpointId } = req.params;
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '') || '';

  const gateway = getInferenceGateway();

  try {
    const status = await gateway.getEndpointStatus(endpointId, apiKey);
    
    // Return OpenAI-compatible models response
    res.json({
      object: 'list',
      data: [
        {
          id: endpointId,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'kriptik-user',
        },
      ],
    });
  } catch (error) {
    res.status(401).json({
      error: {
        message: error instanceof Error ? error.message : 'Authentication failed',
        type: 'invalid_api_key',
        code: 'invalid_api_key',
      },
    });
  }
});

export default router;
