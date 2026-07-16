/**
 * Convenience aliases over the generated OpenAPI types (src/api/schema.d.ts).
 * Everything here derives from components["schemas"] — no hand-written
 * mirrors of server shapes.
 */
import type { components } from "./schema";

type Schemas = components["schemas"];

export type ProjectSummary = Schemas["ProjectSummary"];
export type ProjectDetail = Schemas["ProjectDetail"];
export type ProjectAgent = Schemas["ProjectAgent"];
export type ProjectCreateResponse = Schemas["ProjectCreateResponse"];

export type FileTree = Schemas["FileTree"];
export type FileEntry = Schemas["FileEntry"];
export type FileContent = Schemas["FileContent"];
export type WriteRequest = Schemas["WriteRequest"];
export type ValidateRequest = Schemas["ValidateRequest"];
export type ValidationResult = Schemas["ValidationResult"];
export type ValidationIssue = Schemas["ValidationIssue"];

export type CatalogEntry = Schemas["CatalogEntryModel"];
export type CatalogArtifactDetail = Schemas["CatalogArtifactDetail"];
export type CatalogVersion = Schemas["CatalogVersionModel"];
export type CatalogFiles = Schemas["CatalogFiles"];
export type PromoteRequest = Schemas["PromoteRequest"];
export type PromoteResponse = Schemas["PromoteResponse"];
export type DeprecateRequest = Schemas["DeprecateRequest"];
export type DeprecateResponse = Schemas["DeprecateResponse"];

export type DoctorReport = Schemas["DoctorReport"];
export type DoctorCheck = Schemas["DoctorCheckModel"];

export type ObsRows = Schemas["ObsRows"];

export type RunListItem = Schemas["RunListItem"];
export type RunArtifactView = Schemas["RunArtifactView"];
export type ApprovalItem = Schemas["ApprovalItem"];

export type EvalRunRow = Schemas["EvalRunRow"];
export type EvalLaunchRequest = Schemas["EvalLaunchRequest"];
export type EvalCompareRequest = Schemas["EvalCompareRequest"];

export type VersionsResponse = Schemas["VersionsResponse"];
export type CommitModel = Schemas["CommitModel"];
export type ArtifactVersions = Schemas["ArtifactVersions"];
export type DiffResponse = Schemas["DiffResponse"];
export type FileDiff = Schemas["FileDiff"];
export type RollbackRequest = Schemas["RollbackRequest"];
export type RollbackResponse = Schemas["RollbackResponse"];
export type PreflightCheck = Schemas["PreflightCheckModel"];
export type ComputeVersionResponse = Schemas["ComputeVersionResponse"];

export type ConnectionInfo = Schemas["ConnectionInfo"];
export type ConnectionHealthResponse = Schemas["ConnectionHealthResponse"];

export type StorageStats = Schemas["StorageStats"];
export type GcRequest = Schemas["GcRequest"];
export type GcReport = Schemas["GcReportModel"];
export type ArchiveRequest = Schemas["ArchiveRequest"];
export type ArchiveReport = Schemas["ArchiveReportModel"];
export type PinRequest = Schemas["PinRequest"];
export type PinnedItem = Schemas["PinnedItemModel"];

export type TaskInfo = Schemas["TaskInfo"];
export type TaskLaunched = Schemas["TaskLaunched"];
export type StudioHealth = Schemas["StudioHealth"];

// --- Phase 10c surfaces -----------------------------------------------------

export type ChatSessionInfo = Schemas["ChatSessionInfo"];
export type ChatMessageRequest = Schemas["ChatMessageRequest"];
export type ChatMessageResponse = Schemas["ChatMessageResponse"];
export type ResumeRequest = Schemas["ResumeRequest"];
export type ResumeResponse = Schemas["ResumeResponse"];

export type ForgeLaunchRequest = Schemas["ForgeLaunchRequest"];
export type ForgeRunInfo = Schemas["ForgeRunInfo"];

export type LayoutsDocument = Schemas["LayoutsDocument"];
