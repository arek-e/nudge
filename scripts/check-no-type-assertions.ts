import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

interface Finding {
  readonly column: number;
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

const sourceRoots = ["apps", "packages"];
const ignoredDirectories = new Set([".tsbuild", ".wrangler", "build", "dist", "node_modules"]);

const findings: Finding[] = [];

function isRuntimeSourceFile(path: string) {
  return (
    (path.endsWith(".ts") || path.endsWith(".tsx")) &&
    !path.endsWith(".d.ts") &&
    !path.endsWith(".test.ts") &&
    !path.endsWith(".test.tsx")
  );
}

function walk(directory: string): ReadonlyArray<string> {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : walk(path);
    }
    return entry.isFile() && isRuntimeSourceFile(path) ? [path] : [];
  });
}

function addFinding(sourceFile: ts.SourceFile, node: ts.Node, message: string) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  findings.push({
    column: position.character + 1,
    file: relative(process.cwd(), sourceFile.fileName),
    line: position.line + 1,
    message,
  });
}

function checkImportDeclaration(sourceFile: ts.SourceFile, node: ts.ImportDeclaration) {
  const namedBindings = node.importClause?.namedBindings;
  if (!namedBindings) return;

  if (ts.isNamespaceImport(namedBindings)) {
    addFinding(sourceFile, namedBindings, "namespace imports are aliases; import named exports");
    return;
  }

  for (const element of namedBindings.elements) {
    if (element.propertyName) {
      addFinding(sourceFile, element, "import aliases hide the source name; import the real name");
    }
  }
}

function checkSourceFile(file: string) {
  const text = readFileSync(file, "utf8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      checkImportDeclaration(sourceFile, node);
    }
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      addFinding(sourceFile, node, "type assertions are not allowed in runtime source");
    }
    if (ts.isNonNullExpression(node)) {
      addFinding(sourceFile, node, "non-null assertions are not allowed in runtime source");
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

for (const sourceRoot of sourceRoots) {
  for (const file of walk(join(process.cwd(), sourceRoot))) {
    checkSourceFile(file);
  }
}

if (findings.length > 0) {
  console.error("Runtime source must not use import aliases or TypeScript assertions.");
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}:${finding.column} ${finding.message}`);
  }
  process.exitCode = 1;
}
