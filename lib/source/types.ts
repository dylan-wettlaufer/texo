/** Presentation ranges use inclusive, one-based lines, unlike parser offsets. */
export interface LineRange { startLine: number; endLine: number }
export type TokenKind = "plain" | "keyword" | "string" | "number" | "comment";
export interface SourceToken { text: string; kind: TokenKind }
export interface SourceLine { number: number; tokens: SourceToken[] }
