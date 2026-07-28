/**
 * Kept dependency-free so low-level HTTP and compatibility modules can read
 * the protocol version without creating a sharedApi <-> sharedProtocol cycle.
 */
export const CLIENT_SHARED_PROTOCOL_VERSION = 5
