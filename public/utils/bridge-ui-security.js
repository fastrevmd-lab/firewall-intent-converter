import { DeviceRegistrationError } from './device-registration.js';

const STATUS_MESSAGES = new Map([
  [401, 'Bridge access token is missing or invalid.'],
  [403, 'This browser origin is not allowed by the bridge.'],
  [429, 'Bridge request limit reached. Wait and try again.'],
]);

const OPERATION_FALLBACKS = Object.freeze({
  connection: 'Connection failed. Check the bridge service and try again.',
  'add-device': 'Failed to add device.',
  'remove-device': 'Failed to remove device.',
});

const REGISTRATION_MESSAGES = new Set([
  'Name, host, and username are required.',
  'Device port is invalid.',
  'Authentication method is invalid.',
  'Password environment variable name is invalid.',
]);

export function bridgeDisplayError(operation, error) {
  if (
    error instanceof DeviceRegistrationError
    && REGISTRATION_MESSAGES.has(error.message)
  ) {
    return error.message;
  }
  const statusMessage = STATUS_MESSAGES.get(error?.status);
  if (statusMessage) return statusMessage;
  return OPERATION_FALLBACKS[operation] || 'Bridge operation failed.';
}

export function createLatestBridgeAttemptGuard() {
  let generation = 0;

  return Object.freeze({
    begin() {
      const attemptGeneration = ++generation;
      return Object.freeze({
        isCurrent: () => attemptGeneration === generation,
        commit(update) {
          if (attemptGeneration !== generation) return false;
          update();
          return true;
        },
      });
    },
    invalidate() {
      generation += 1;
    },
  });
}

export function createExclusiveBridgeMutationLock() {
  let owner = null;

  return Object.freeze({
    acquire() {
      if (owner) return null;
      const token = Symbol('bridge-mutation');
      owner = token;
      return Object.freeze({
        release() {
          if (owner !== token) return false;
          owner = null;
          return true;
        },
      });
    },
    reset() {
      owner = null;
    },
  });
}
