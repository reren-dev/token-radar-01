import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

// 1. Run main.ts first to generate everything in out/
console.log('Running main.ts to build output...');
execSync('npx tsx main.ts', { stdio: 'inherit' });

// 2. Start local HTTP server serving out/ directory
const server = http.createServer((req, res) => {
  let reqPath = req.url === '/' ? '/dashboard/index.html' : req.url;
  reqPath = reqPath.split('?')[0];
  let filePath = path.join('out', reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found: ' + reqPath);
    return;
  }

  const ext = path.extname(filePath);
  const map = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png'
  };
  res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(8989, async () => {
  console.log('Server started on port 8989 serving out/');
  try {
    fs.mkdirSync('out/screenshots', { recursive: true });
    fs.mkdirSync('screenshots', { recursive: true });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Load dashboard from out/
    await page.goto('http://localhost:8989/dashboard/index.html', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    // Screenshot 1: Board view (Watchlist floor default)
    await page.screenshot({ path: 'out/screenshots/board.png', fullPage: false });
    fs.copyFileSync('out/screenshots/board.png', 'screenshots/board.png');
    console.log('Captured board.png');

    // Screenshot 2: Detail view (click first row)
    const firstRow = await page.$('#table-body tr');
    if (firstRow) {
      await firstRow.click();
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: 'out/screenshots/detail.png', fullPage: false });
      fs.copyFileSync('out/screenshots/detail.png', 'screenshots/detail.png');
      console.log('Captured detail.png');
    }

    // Screenshot 3: Filtered view (click Pre-Token filter button)
    const closeBtn = await page.$('#modal-close');
    if (closeBtn) {
      await closeBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }
    const preBtn = await page.$('button[data-filter="pre"]');
    if (preBtn) {
      await preBtn.click();
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: 'out/screenshots/filtered.png', fullPage: false });
      fs.copyFileSync('out/screenshots/filtered.png', 'screenshots/filtered.png');
      console.log('Captured filtered.png');
    }

    await browser.close();
    server.close();

    // Re-run main.ts to include new screenshots in dossier.json
    console.log('Re-running main.ts to update dossier with new screenshots...');
    execSync('npx tsx main.ts', { stdio: 'inherit' });

    console.log('All screenshots captured and dossier updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error capturing screenshots:', err);
    server.close();
    process.exit(1);
  }
});
