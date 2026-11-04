#!/usr/bin/env node
// Node.js only; works on Windows, macOS and Linux without extra packages.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, mkdtempSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../skills/iivv');
const help = `Install iivv for DeepSeek Harness (Node.js 18+).
  node scripts/install-deepseek.mjs [--project PATH | --dsh-home PATH] [--update | --check]
Default: $DSH_HOME/skills/iivv or ~/.dsh/skills/iivv.
--project PATH  Use the nearest Git project root, or PATH if no .git ancestor exists.
--dsh-home PATH Use this Harness configuration home (overrides DSH_HOME).
--update        Back up an existing installation, then replace it.
--check         Verify installation bytes without changing files.
--help          Show this help.`;

function files(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const name = join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not supported: ${name}`);
    if (entry.isDirectory()) return files(root, name);
    if (!entry.isFile()) throw new Error(`Not a regular file: ${name}`);
    return [name];
  }).sort();
}

function verifyBundle(root) {
  const text = readFileSync(join(root, 'SKILL.md'), 'utf8');
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!front || !/^name: iivv\s*$/m.test(front) || !/^description: \S.+$/m.test(front)) {
    throw new Error('Invalid iivv SKILL.md name or description');
  }
  for (const name of ['callbacks', 'patterns', 'reactions', 'sources']) {
    readFileSync(join(root, 'references', `${name}.md`));
  }
  const manifest = JSON.parse(readFileSync(join(root, 'assets/manifest.json'), 'utf8'));
  for (const item of manifest) {
    const path = resolve(root, item.path);
    const rel = relative(root, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid resource path');
    const data = readFileSync(path);
    if (data.length !== item.bytes || createHash('sha256').update(data).digest('hex') !== item.sha256) {
      throw new Error(`Image checksum mismatch: ${item.path}`);
    }
  }
  return files(root);
}

function verifyCopy(target) {
  const expected = verifyBundle(source);
  const actual = verifyBundle(target);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Installed file list differs');
  for (const name of expected) {
    if (!readFileSync(join(source, name)).equals(readFileSync(join(target, name)))) {
      throw new Error(`Installed file differs: ${name}`);
    }
  }
  return expected.length;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log(help); return; }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (['--project', '--dsh-home'].includes(key)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value: ${key}`);
      options[key] = args[++i];
    } else if (['--update', '--check'].includes(key)) options[key] = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  if (options['--project'] && options['--dsh-home']) throw new Error('Choose --project or --dsh-home');
  if (options['--update'] && options['--check']) throw new Error('Choose --update or --check');
  let base = resolve(options['--dsh-home'] || process.env.DSH_HOME || join(homedir(), '.dsh'));
  if (options['--project']) {
    const requested = resolve(options['--project']);
    if (!existsSync(requested) || !lstatSync(requested).isDirectory()) throw new Error('Project directory must exist');
    let project = requested;
    while (!existsSync(join(project, '.git')) && dirname(project) !== project) project = dirname(project);
    base = join(existsSync(join(project, '.git')) ? project : requested, '.dsh');
  }
  const target = join(base, 'skills', 'iivv');
  if (options['--check']) {
    console.log(`Verified ${verifyCopy(target)} files: ${target}`);
    return;
  }
  verifyBundle(source);
  if (existsSync(target) && !options['--update']) throw new Error(`Already installed: ${target}. Use --check or --update.`);
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error('Refusing to replace a symlink');
  mkdirSync(dirname(target), { recursive: true });
  const staging = mkdtempSync(join(dirname(target), '.iivv-install-'));
  let backup;
  try {
    cpSync(source, staging, { recursive: true });
    const count = verifyCopy(staging);
    if (existsSync(target)) {
      const backupRoot = join(base, 'skill-backups');
      mkdirSync(backupRoot, { recursive: true });
      const container = mkdtempSync(join(backupRoot, 'iivv-'));
      backup = join(container, 'iivv');
      renameSync(target, backup);
    }
    try { renameSync(staging, target); }
    catch (error) { if (backup) renameSync(backup, target); throw error; }
    console.log(`Installed and verified ${count} files: ${target}`);
    if (backup) console.log(`Previous installation: ${backup}`);
    console.log('In DeepSeek Harness, send: /iivv 开启咒回模式，标准发癫，表情包自动。');
  } finally { rmSync(staging, { recursive: true, force: true }); }
}

try { main(); } catch (error) { console.error(`iivv: ${error.message}`); process.exitCode = 1; }
