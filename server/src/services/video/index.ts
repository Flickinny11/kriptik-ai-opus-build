/**
 * Video Services Index
 *
 * Exports video generation and rendering services.
 * Currently includes Remotion integration for programmatic video generation.
 */

export {
  RemotionService,
  getRemotionService,
  type VideoRenderRequest,
  type Video3DRenderRequest,
  type RenderedVideo,
  type PreviewGifResult,
} from './remotion-service.js';
