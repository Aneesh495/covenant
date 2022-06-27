import fs from "fs";
import path from "path";

export interface FileLoc {
  filePath: string;
  module: string;
  totalLines: number;
  substantiveLines: number;
  blankLines: number;
  commentLines: number;
}

export interface LocCensusResult {
  timestamp: string;
  productionSubstantiveTotal: number;
  testSubstantiveTotal: number;
  byModule: Record<string, { productionSubstantive: number; testSubstantive: number; fileCount: number }>;
  files: FileLoc[];
}

const EXCLUDE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".cache",
  "coverage",
  "models",
  "uploads",
  "artifacts",
]);

// Directories specifically containing copied UI primitives that are excluded from production substantive LOC
const COPIED_UI_PATHS = [
  "client/src/components/ui",
  "apps/web/src/components/ui",
];

function isCommentOrBlank(line: string, inBlockComment: { val: boolean }): { isBlank: boolean; isComment: boolean } {
  const trimmed = line.trim();
  if (!trimmed) {
    return { isBlank: true, isComment: false };
  }

  if (inBlockComment.val) {
    if (trimmed.includes("*/")) {
      inBlockComment.val = false;
      const after = trimmed.substring(trimmed.indexOf("*/") + 2).trim();
      if (!after) {
        return { isBlank: false, isComment: true };
      }
    } else {
      return { isBlank: false, isComment: true };
    }
  }

  if (trimmed.startsWith("/*")) {
    if (trimmed.includes("*/")) {
      const after = trimmed.substring(trimmed.indexOf("*/") + 2).trim();
      if (!after) {
        return { isBlank: false, isComment: true };
      }
    } else {
      inBlockComment.val = true;
      return { isBlank: false, isComment: true };
    }
  }

  if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("--")) {
    return { isBlank: false, isComment: true };
  }

  return { isBlank: false, isComment: false };
}

export function countFileLines(filePath: string): { total: number; substantive: number; blank: number; comment: number } {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  let substantive = 0;
  let blank = 0;
  let comment = 0;
  const inBlockComment = { val: false };

  for (const line of lines) {
    const { isBlank, isComment } = isCommentOrBlank(line, inBlockComment);
    if (isBlank) {
      blank++;
    } else if (isComment) {
      comment++;
    } else {
      substantive++;
    }
  }

  return { total: lines.length, substantive, blank, comment };
}

function shouldScanFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const allowedExts = new Set([".ts", ".tsx", ".js", ".jsx", ".sql"]);
  return allowedExts.has(ext);
}

function isTestFile(relPath: string): boolean {
  return (
    relPath.includes(".test.") ||
    relPath.includes(".spec.") ||
    relPath.startsWith("tests/") ||
    relPath.includes("/tests/") ||
    relPath.includes("/__tests__/")
  );
}

function isFixtureFile(relPath: string): boolean {
  return relPath.includes("/fixtures/") || relPath.includes("/corpus/") || relPath.includes("/samples/");
}

function isCopiedUiPrimitive(relPath: string): boolean {
  return COPIED_UI_PATHS.some((p) => relPath.startsWith(p));
}

function isArchivedLegacy(relPath: string): boolean {
  return relPath.startsWith("archive/") || relPath.startsWith("legacy/");
}

function determineModule(relPath: string): string {
  const parts = relPath.split(path.sep);
  if (parts[0] === "packages" && parts.length > 1) {
    return `packages/${parts[1]}`;
  }
  if (parts[0] === "apps" && parts.length > 1) {
    return `apps/${parts[1]}`;
  }
  if (parts[0] === "server") {
    return "server";
  }
  if (parts[0] === "client") {
    return "client";
  }
  if (parts[0] === "shared") {
    return "shared";
  }
  if (parts[0] === "tests") {
    return "tests";
  }
  if (parts[0] === "scripts") {
    return "scripts";
  }
  return "root";
}

export function runCensus(rootDir: string): LocCensusResult {
  const fileLocs: FileLoc[] = [];
  const byModule: Record<string, { productionSubstantive: number; testSubstantive: number; fileCount: number }> = {};

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath);

        if (!shouldScanFile(fullPath)) continue;
        if (isFixtureFile(relPath) || isCopiedUiPrimitive(relPath) || isArchivedLegacy(relPath)) continue;

        const { total, substantive, blank, comment } = countFileLines(fullPath);
        const mod = determineModule(relPath);

        if (!byModule[mod]) {
          byModule[mod] = { productionSubstantive: 0, testSubstantive: 0, fileCount: 0 };
        }

        byModule[mod].fileCount++;

        const isTest = isTestFile(relPath);
        if (isTest) {
          byModule[mod].testSubstantive += substantive;
        } else {
          byModule[mod].productionSubstantive += substantive;
        }

        fileLocs.push({
          filePath: relPath,
          module: mod,
          totalLines: total,
          substantiveLines: substantive,
          blankLines: blank,
          commentLines: comment,
        });
      }
    }
  }

  walk(rootDir);

  let productionSubstantiveTotal = 0;
  let testSubstantiveTotal = 0;

  for (const modData of Object.values(byModule)) {
    productionSubstantiveTotal += modData.productionSubstantive;
    testSubstantiveTotal += modData.testSubstantive;
  }

  return {
    timestamp: new Date().toISOString(),
    productionSubstantiveTotal,
    testSubstantiveTotal,
    byModule,
    files: fileLocs,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootDir = process.cwd();
  const census = runCensus(rootDir);
  const ledgerPath = path.join(rootDir, ".build_ledger.json");
  fs.writeFileSync(ledgerPath, JSON.stringify(census, null, 2));

  console.log(`LOC Census Run: ${census.timestamp}`);
  console.log(`Substantive Production Lines (excluding tests, comments, blanks, copied UI primitives): ${census.productionSubstantiveTotal}`);
  console.log(`Substantive Test Lines: ${census.testSubstantiveTotal}`);
  console.log("\nPer-module Breakdown:");
  for (const [mod, data] of Object.entries(census.byModule)) {
    console.log(`  - ${mod}: ${data.productionSubstantive} prod lines, ${data.testSubstantive} test lines (${data.fileCount} files)`);
  }
}
