/**
 * Priority queue implementation for request management
 */

import type { QueueConfig, PerCallOptions } from './types';

type Priority = NonNullable<PerCallOptions['priority']>;

export interface QueuedRequest {
  id: number;
  priority: Priority;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  methodPath: string;
}

export interface QueueState {
  queue: QueuedRequest[];
  running: number;
  paused: boolean;
  nextId: number;
  config: QueueConfig;
  onQueueChange?: (size: number) => void;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function createQueue(config: QueueConfig): QueueState {
  return {
    queue: [],
    running: 0,
    paused: false,
    nextId: 0,
    config,
  };
}

function sortByPriority(a: QueuedRequest, b: QueuedRequest): number {
  const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return a.id - b.id;
}

function canProcessNext(state: QueueState): boolean {
  if (state.paused) return false;
  const concurrency = state.config.concurrency ?? Infinity;
  if (state.running >= concurrency) return false;
  return state.queue.length > 0;
}

function executeWithTimeout(
  request: QueuedRequest,
  timeoutMs: number | undefined,
): Promise<unknown> {
  if (!timeoutMs) {
    return request.execute();
  }

  return Promise.race([
    request.execute(),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timed out'));
      }, timeoutMs);
    }),
  ]);
}

function processNext(state: QueueState): void {
  if (!canProcessNext(state)) return;

  state.queue.sort(sortByPriority);
  const request = state.queue.shift();
  if (!request) return;

  state.running++;
  state.onQueueChange?.(state.queue.length);

  void executeWithTimeout(request, state.config.timeout)
    .then((result) => {
      request.resolve(result);
    })
    .catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      request.reject(err);
    })
    .finally(() => {
      state.running--;
      processNext(state);
    });
}

interface EnqueueOptions {
  methodPath: string;
  priority: Priority;
  execute: () => Promise<unknown>;
}

export function enqueue(
  state: QueueState,
  options: EnqueueOptions,
): Promise<unknown> {
  const maxSize = state.config.maxSize ?? Infinity;
  if (state.queue.length >= maxSize) {
    return Promise.reject(new Error('Queue is full'));
  }

  return new Promise((resolve, reject) => {
    const request: QueuedRequest = {
      id: state.nextId++,
      priority: options.priority,
      execute: options.execute,
      resolve,
      reject,
      methodPath: options.methodPath,
    };

    state.queue.push(request);
    state.onQueueChange?.(state.queue.length);

    processNext(state);
  });
}

export function pauseQueue(state: QueueState): void {
  state.paused = true;
}

export function resumeQueue(state: QueueState): void {
  state.paused = false;
  processNext(state);
}

export function clearQueue(state: QueueState): void {
  const cleared = state.queue.splice(0);
  for (const request of cleared) {
    request.reject(new Error('Queue cleared'));
  }
  state.onQueueChange?.(0);
}

export function getQueueSize(state: QueueState): number {
  return state.queue.length;
}

export function getRunningCount(state: QueueState): number {
  return state.running;
}
