/**
 * Type anchor for the platform-split implementations. Metro picks
 * openVault.native.ts or openVault.web.ts per platform; TypeScript reads this.
 */
import type { VaultApi } from "@wovera/core";

export declare function openVault(): Promise<VaultApi>;
