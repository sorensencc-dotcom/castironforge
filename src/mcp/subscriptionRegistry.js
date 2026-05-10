// src/mcp/subscriptionRegistry.js | 2026-05-10 | 1.0.0
/**
 * Subscription Registry
 * Manages in-memory tracking of WebSocket clients and their event interests.
 */

import crypto from 'node:crypto';

/**
 * @typedef {Object} Subscriber
 * @property {string} clientId
 * @property {string[]} eventTypes
 * @property {import('ws').WebSocket} wsSocket
 * @property {string} connectedAt
 */

/** @type {Map<string, Subscriber>} */
const registry = new Map();

/**
 * Register a client and its interested event types.
 * @param {string[]} eventTypes
 * @param {import('ws').WebSocket} wsSocket
 * @returns {string} The assigned clientId
 */
export function register(eventTypes, wsSocket) {
  const clientId = crypto.randomUUID();
  registry.set(clientId, {
    clientId,
    eventTypes,
    wsSocket,
    connectedAt: new Date().toISOString()
  });
  return clientId;
}

/**
 * Remove a client from the registry.
 * @param {string} clientId
 * @returns {void}
 */
export function unregister(clientId) {
  registry.delete(clientId);
}

/**
 * Get all WebSocket sockets subscribed to a specific event type.
 * @param {string} eventType
 * @returns {import('ws').WebSocket[]}
 */
export function getSubscribers(eventType) {
  const subscribers = [];
  for (const sub of registry.values()) {
    // Audit agent or wildcard subscribers might want everything, 
    // but spec says explicit mapping. We'll support exact match.
    if (sub.eventTypes.includes(eventType) || sub.eventTypes.includes('*')) {
      subscribers.push(sub.wsSocket);
    }
  }
  return subscribers;
}

/**
 * List all current subscriptions.
 * @returns {Array<{ clientId: string, eventTypes: string[], connectedAt: string }>}
 */
export function listAll() {
  return Array.from(registry.values()).map(sub => ({
    clientId: sub.clientId,
    eventTypes: sub.eventTypes,
    connectedAt: sub.connectedAt
  }));
}

/**
 * Get total subscriber count.
 * @returns {number}
 */
export function getTotalCount() {
  return registry.size;
}
