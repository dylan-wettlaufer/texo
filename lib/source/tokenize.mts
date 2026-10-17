import ts from "typescript";
import type { SourceLine, SourceToken, TokenKind } from "./types.ts";

/** Display tokens only. Analysis and declaration ranges belong to the parser. */
export function tokenizeSource(content: string, filePath: string): SourceLine[] {
  const lines = [{ number: 1, tokens: [] as SourceToken[] }];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, /\.(?:jsx|tsx)$/.test(filePath) ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, content);
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    const kind: TokenKind = token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastKeyword ? "keyword"
      : token === ts.SyntaxKind.StringLiteral || token === ts.SyntaxKind.NoSubstitutionTemplateLiteral ? "string"
      : token === ts.SyntaxKind.NumericLiteral ? "number"
      : token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia ? "comment" : "plain";
    for (const text of scanner.getTokenText().split(/(\n)/)) {
      if (text === "\n") lines.push({ number: lines.length + 1, tokens: [] });
      else if (text) lines[lines.length - 1].tokens.push({ text, kind });
    }
    token = scanner.scan();
  }
  return lines;
}
