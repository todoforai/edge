/** Tool definitions: re-exports the shared catalog. Install/uninstall command
 *  logic lives in shared-fbe toolInstallCommand (see tool-registry.ts). */

export { TOOL_CATALOG } from "../../../packages/shared-fbe/src/toolCatalog";
export type { ToolEntry, ToolInstaller, ToolCategory } from "../../../packages/shared-fbe/src/toolCatalog";
