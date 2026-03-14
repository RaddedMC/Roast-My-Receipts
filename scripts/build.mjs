import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const rootDir = resolve(process.cwd());
const srcDir = join(rootDir, "src");
const distDir = join(rootDir, "dist");
const vendoredOpenAIPath = join(distDir, "vendor", "openai", "index.mjs");

if (process.argv.includes("--clean") && existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(distDir, { recursive: true });

walk(srcDir);
copyIfExists("node_modules/openai", "vendor/openai");
copyIfExists("README.md");

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const sourcePath = join(directory, entry);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      walk(sourcePath);
      continue;
    }

    const relativePath = relative(srcDir, sourcePath);
    const extension = extname(sourcePath);
    const outputRelativePath = extension === ".ts"
      ? relativePath.replace(/\.ts$/, ".js")
      : relativePath;
    const outputPath = join(distDir, outputRelativePath);

    mkdirSync(dirname(outputPath), { recursive: true });

    if (extension === ".ts") {
      let contents = readFileSync(sourcePath, "utf8");
      contents = contents.replace(/from\s+["'](\.{1,2}\/[^"']+)\.ts["']/g, 'from "$1.js"');
      contents = contents.replace(/import\s+["'](\.{1,2}\/[^"']+)\.ts["']/g, 'import "$1.js"');
      contents = rewriteOpenAIImports(contents, outputPath);
      writeFileSync(outputPath, contents);
      continue;
    }

    cpSync(sourcePath, outputPath, { recursive: false });
  }
}

function copyIfExists(inputPathName, outputPathName = inputPathName) {
  const input = join(rootDir, inputPathName);
  if (!existsSync(input)) {
    return;
  }
  const output = join(distDir, outputPathName);
  mkdirSync(dirname(output), { recursive: true });
  cpSync(input, output, { recursive: true });
}

function rewriteOpenAIImports(contents, outputPath) {
  const openAIImportPath = relative(dirname(outputPath), vendoredOpenAIPath).replace(/\\/g, "/");
  const normalizedImportPath = openAIImportPath.startsWith(".")
    ? openAIImportPath
    : `./${openAIImportPath}`;

  return contents.replace(/from\s+["']openai["']/g, `from "${normalizedImportPath}"`);
}
