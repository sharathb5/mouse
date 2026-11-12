/**
 * Workstream C consumer executors + page extraction. Loaded only when Extract / Compare /
 * Track (or extract-snapshot) runs, not on every page parse.
 */
export { createConsumerActionRegistry } from '../consumer/registry';
export { buildPageSelectedContext } from '../consumer/context';
export { runRegisteredAction } from '../consumer/run-action';
export { snapshotFromDocument } from '@/core/tracking';
