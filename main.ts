import * as fs from 'fs';
import * as path from 'path';
import { parseSnapshot, buildRadar, boardIssue, dataScript } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

function parseArgs() {
  const args = process.argv.slice(2);
  let inputPath = '/home/hatch/workspace/makefun/token-radar-01-kit/token-radar-01-kit/input/snapshot.json';
  let outputPath = process.env.MAKEFUN_OUTPUT_DIR || '/output';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    }
  }

  if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
    inputPath = path.join(inputPath, 'snapshot.json');
  }

  return { inputPath, outputPath };
}

function copyRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function main() {
  const { inputPath, outputPath } = parseArgs();

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Snapshot file not found at ${inputPath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(inputPath, 'utf8');
  const snapshot = parseSnapshot(rawText);
  const { board, radar } = buildRadar(snapshot);

  const issue = boardIssue(board, snapshot);
  if (issue) {
    console.error(`Error: Board validation failed: ${issue}`);
    process.exit(1);
  }

  let finalOut = outputPath;
  try {
    fs.mkdirSync(finalOut, { recursive: true });
    fs.accessSync(finalOut, fs.constants.W_OK);
  } catch {
    finalOut = path.resolve('out');
    fs.mkdirSync(finalOut, { recursive: true });
  }

  // 1. Write board.json
  const boardJsonPath = path.join(finalOut, 'board.json');
  fs.writeFileSync(boardJsonPath, JSON.stringify({ rows: board }, null, 2), 'utf8');

  // 2. Write data.js
  const dataJsPath = path.join(finalOut, 'data.js');
  fs.writeFileSync(dataJsPath, dataScript(radar), 'utf8');

  // 3. Copy dashboard/ and screenshots/
  const dashboardSrc = path.resolve('dashboard');
  const dashboardDest = path.join(finalOut, 'dashboard');
  if (fs.existsSync(dashboardSrc)) {
    copyRecursive(dashboardSrc, dashboardDest);
  }

  const screenshotsSrc = path.resolve('screenshots');
  const screenshotsDest = path.join(finalOut, 'screenshots');
  if (fs.existsSync(screenshotsSrc)) {
    copyRecursive(screenshotsSrc, screenshotsDest);
  }

  // 4. Write dossier.json LAST by calling buildDossier and writing the returned bytes
  try {
    const caps = {
      text_max_bytes: 65536,
      screenshots: { max: 4, max_bytes: 524288 },
      dashboard: { max_files: 400, max_bytes: 4194304 }
    };
    const dossierBytes = buildDossier(finalOut, caps);
    const dossierPath = path.join(finalOut, 'dossier.json');
    fs.writeFileSync(dossierPath, dossierBytes);
    console.log(`Successfully built dossier at ${dossierPath} (${dossierBytes.length} bytes)`);
  } catch (err: any) {
    console.error(`Error building dossier: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
