import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'install-deepseek.mjs');
const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], {
  encoding: 'utf8', env: { ...process.env, ...env },
});

test('install, verify, refuse overwrite, detect corruption and back up update', () => {
  const root = mkdtempSync(join(tmpdir(), 'iivv dsh-'));
  const args = ['--dsh-home', root];
  try {
    let result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(run([...args, '--check']).status, 0);
    assert.equal(run(args).status, 1);
    const entry = join(root, 'skills/iivv/SKILL.md');
    const original = readFileSync(entry, 'utf8');
    writeFileSync(entry, original + '\nUser customization\n');
    assert.equal(run([...args, '--check']).status, 1);
    result = run([...args, '--update']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(entry, 'utf8'), original);
    const backup = readdirSync(join(root, 'skill-backups'))[0];
    assert.match(readFileSync(join(root, 'skill-backups', backup, 'iivv/SKILL.md'), 'utf8'), /User customization/);
    assert.equal(run([...args, '--check']).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('DSH_HOME is respected', () => {
  const root = mkdtempSync(join(tmpdir(), 'iivv-env-'));
  try {
    const result = run([], { DSH_HOME: root });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(root, 'skills/iivv/assets/manifest.json')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('project install finds nearest .git ancestor including worktree markers', () => {
  const root = mkdtempSync(join(tmpdir(), 'iivv-project-'));
  try {
    writeFileSync(join(root, '.git'), 'gitdir: unused-in-test');
    const sub = join(root, 'nested');
    mkdirSync(sub);
    const result = run(['--project', sub]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(root, '.dsh/skills/iivv/SKILL.md')));
    assert.ok(!existsSync(join(sub, '.dsh')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('non-Git project uses the requested directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'iivv-nogit-'));
  try {
    const result = run(['--project', root]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(root, '.dsh/skills/iivv/SKILL.md')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('invalid arguments fail before writing', () => {
  for (const args of [['--unknown'], ['--project'], ['--dsh-home'], ['--check', '--update'], ['--project', '.', '--dsh-home', '.']]) {
    assert.equal(run(args).status, 1);
  }
  assert.equal(run(['--help']).status, 0);
});
