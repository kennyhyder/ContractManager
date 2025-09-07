/**
 * Contract Management System SDK
 * 
 * Main entry point for the TypeScript SDK
 */

export { ContractManagementSDK, createClient } from './client';
export type { SDKConfig } from './client';

// Export all types
export * from './types';

// Version
export const VERSION = '1.0.0';

// Default export
import { createClient } from './client';
export default createClient;