/**
 * WebSocket Services
 *
 * Real-time communication services for KripTik AI.
 */

export {
  EndpointEventEmitter,
  getEndpointEventEmitter,
  initializeEndpointWebSocket,
  type EndpointEvent,
  type EndpointEventType,
  type DeploymentStartedEvent,
  type DeploymentProgressEvent,
  type DeploymentCompleteEvent,
  type DeploymentFailedEvent,
  type EndpointStatusChangedEvent,
  type EndpointHealthAlertEvent,
  type EndpointUsageUpdateEvent,
  type CreditsLowWarningEvent,
  type EndpointRecoveryEvent,
} from './endpoint-events.js';
