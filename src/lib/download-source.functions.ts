import { createServerFn } from '@tanstack/react-start';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.output', '.vinxi', '.tanstack', '.cache', 'coverage', '.lovable', '.workspace']);
const SKIP_FILES = new Set(['.env', '.env.local', '.env.production', 'tsconfig.tsbuildinfo']);
const MAX_FILE_BYTES = 4 * 1024 * 1024; // skip huge binaries

const RUN_INSTRUCTIONS = `# Birthday Arcade — full website source

This zip contains every source file that powers the website:
pages, styles, games, settings, images and configuration.

## Run it locally

1. Install Node.js 20+ (or Bun) on your computer.
2. Open a terminal in this folder.
3. Install dependencies:

   npm install
   (or: bun install)

4. Start the site:

   npm run dev
   (or: bun run dev)

5. Open the address shown in the terminal (usually http://localhost:8080).

## Build for production

   npm run build

That's it — the whole web app is in here.
`;

function collectFiles(rootDir: string, relativeBase = ''): { rel: string; abs: string }[] {
  const results: { rel: string; abs: string }[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(rootDir, entry.name);
    const rel = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectFiles(abs, rel));
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      try {
        const stat = fs.statSync(abs);
        if (stat.size > MAX_FILE_BYTES) continue;
      } catch {
        continue;
      }
      results.push({ rel, abs });
    }
  }
  return results;
}

export const downloadSourceZip = createServerFn({ method: 'GET' }).handler(async () => {
  const projectRoot = process.cwd();
  const files = collectFiles(projectRoot);
  const zip = new JSZip();
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.abs);
      zip.file(file.rel, content);
    } catch {
      // skip unreadable files
    }
  }
  zip.file('HOW-TO-RUN.md', RUN_INSTRUCTIONS);
  const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  return { base64, fileCount: files.length };
});
