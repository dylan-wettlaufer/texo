import type { FileDetail, RepositorySummary } from "../repository/query-types.mts";
import type { SourceLine } from "../source/types.ts";
import type { SourceRange } from "../repository/types.mts";

export type LocalFileDetail = Omit<FileDetail, "content"> & { lines: SourceLine[] };
export interface SnapshotResult<T> { revision: string; data: T }
export type LocalSummary = RepositorySummary;
export interface RepositorySelection { fileId: string; declarationId?: string; callRange?: SourceRange; revision?: string }
export interface RepositoryHistory { entries: RepositorySelection[]; index: number }
