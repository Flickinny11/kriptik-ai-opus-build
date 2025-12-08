/**
 * 3D Components Index
 *
 * Export all Three.js/React Three Fiber components
 * with bulletproof error handling and CSS fallbacks
 */

// Core scene with error handling
export { Scene3D } from './Scene';

// Error boundary and CSS fallbacks
export {
  Scene3DErrorBoundary,
  CSSGlassSphere,
  CSSGlassSphereCluster,
  Safe3DScene,
  useScene3DContext,
} from './Scene3DErrorBoundary';

// Glass spheres with adaptive quality
export {
  GlassSphere,
  LimeGlassSphere,
  AmberGlassSphere,
  CyanGlassSphere,
  GlassSphereCluster,
} from './GlassSphere';

// Particle effects
export {
  ParticleField,
  LimeParticleField,
  AmberParticleField,
  WhiteParticleField,
  StarField,
} from './ParticleField';

// Interactive buttons
export {
  MagneticButton,
  MagneticCTA,
  ArrowIcon,
} from './MagneticButton';
