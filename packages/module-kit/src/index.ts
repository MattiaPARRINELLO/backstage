/**
 * `@backstage/module-kit` : le contrat entre le noyau BACKSTAGE et un module.
 *
 * Un module importe ce paquet, jamais l'intérieur du noyau (ADR 0001). Le paquet
 * est consommé en source TypeScript : `tsc --noEmit` le couvre et Next le
 * compile avec le reste de l'application, sans étape de build séparée.
 */
export type { LogLevel, ModuleContext } from "./context";
export {
  assertCompatibleApiVersion,
  defineAction,
  defineModule,
  ModuleIncompatibleError,
  MODULE_ID_PATTERN,
  TOOL_NAME_PATTERN,
  type ActionDefinition,
  type ModuleCapabilities,
  type ModuleDefinition,
  type ModuleEvents,
  type ModuleJob,
  type ModuleUi,
  type PromptContribution,
} from "./module";
export {
  defineTool,
  isConfirmable,
  isUntrusted,
  qualifiedName,
  requiresConfirmation,
  toolEmpty,
  toolError,
  toolOk,
  type AnyToolDefinition,
  type PolicySubject,
  type SideEffect,
  type ToolContext,
  type ToolDefinition,
  type ToolOutput,
  type TrustLevel,
} from "./tool";
export { verifyWrite } from "./verify-write";
export { KERNEL_API } from "./version";
export { formatRelative } from "./format";
export { EmptyState, PageHeader, Skeleton, SkeletonLines } from "./ui";
export {
  ModuleToastProvider,
  useModuleToasts,
  type ModuleToastInput,
  type ModuleToastTone,
  type ModuleToasts,
} from "./toasts";
export {
  ModuleActionsProvider,
  useModuleAction,
  type ModuleActionCall,
  type ModuleActionInvoker,
} from "./module-actions";
export {
  railIcon,
  railIconMarkup,
  RAIL_FALLBACK_ICON,
  type RailIcon,
} from "./rail-icon";
export {
  ModulePanelProvider,
  useModulePanels,
  type ModulePanel,
} from "./module-panels";
export {
  ModuleHomeCardProvider,
  useModuleHomeCards,
  type ModuleHomeCard,
} from "./module-home-cards";
