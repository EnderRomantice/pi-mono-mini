import { appendFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool } from './types.js';

const exec = promisify(execCallback);

export interface CoreToolsOptions {
  /**
   * Restrict file operations to this directory (defaults to process.cwd()).
   */
  rootDir?: string;
  /**
   * Allow absolute paths outside rootDir. Defaults to false.
   */
  allowAbsolutePaths?: boolean;
  /**
   * Default timeout for bash execution in milliseconds.
   */
  bashTimeoutMs?: number;
  /**
   * Default max bytes returned by fs_read_file.
   */
  maxReadBytes?: number;
}

const DEFAULT_BASH_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_READ_BYTES = 1_000_000;

function normalizePath(rawPath: string, rootDir: string, allowAbsolutePaths: boolean): string {
  const target = resolve(rootDir, rawPath);

  if (allowAbsolutePaths) {
    return target;
  }

  const rel = relative(rootDir, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Path is outside allowed root: ${rawPath}`);
  }

  return target;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createCoreTools(options: CoreToolsOptions = {}): Tool[] {
  const rootDir = resolve(options.rootDir || process.cwd());
  const allowAbsolutePaths = options.allowAbsolutePaths ?? false;
  const defaultTimeout = options.bashTimeoutMs ?? DEFAULT_BASH_TIMEOUT_MS;
  const defaultMaxReadBytes = options.maxReadBytes ?? DEFAULT_MAX_READ_BYTES;

  const fsReadFileTool: Tool = {
    name: 'fs_read_file',
    description: 'Read file content from disk.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read.' },
        encoding: { type: 'string', enum: ['utf-8', 'base64'], default: 'utf-8' },
        maxBytes: { type: 'number', description: 'Maximum bytes to return from the start of the file.' },
      },
      required: ['path'],
    },
    async execute(args: { path?: string; encoding?: 'utf-8' | 'base64'; maxBytes?: number }): Promise<string> {
      if (!args?.path) {
        throw new Error('Missing required argument: path');
      }

      const filePath = normalizePath(args.path, rootDir, allowAbsolutePaths);
      const encoding = args.encoding || 'utf-8';
      const maxBytes = args.maxBytes ?? defaultMaxReadBytes;

      const buffer = await readFile(filePath);
      const sliced = buffer.subarray(0, Math.max(1, maxBytes));

      return encoding === 'base64' ? sliced.toString('base64') : sliced.toString('utf-8');
    },
  };

  const fsWriteFileTool: Tool = {
    name: 'fs_write_file',
    description: 'Write or append content to a file on disk.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write.' },
        content: { type: 'string', description: 'Text content to write.' },
        append: { type: 'boolean', default: false, description: 'Append instead of overwrite.' },
      },
      required: ['path', 'content'],
    },
    async execute(args: { path?: string; content?: string; append?: boolean }): Promise<string> {
      if (!args?.path) {
        throw new Error('Missing required argument: path');
      }
      if (typeof args.content !== 'string') {
        throw new Error('Missing required argument: content');
      }

      const filePath = normalizePath(args.path, rootDir, allowAbsolutePaths);
      const dirPath = dirname(filePath);
      await mkdir(dirPath, { recursive: true });

      if (args.append) {
        await appendFile(filePath, args.content, 'utf-8');
      } else {
        await writeFile(filePath, args.content, 'utf-8');
      }

      return `OK: wrote ${args.content.length} chars to ${args.path}`;
    },
  };

  const fsDeletePathTool: Tool = {
    name: 'fs_delete_path',
    description: 'Delete a file or directory from disk.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete.' },
        recursive: { type: 'boolean', default: true, description: 'Delete directory recursively.' },
      },
      required: ['path'],
    },
    async execute(args: { path?: string; recursive?: boolean }): Promise<string> {
      if (!args?.path) {
        throw new Error('Missing required argument: path');
      }

      const targetPath = normalizePath(args.path, rootDir, allowAbsolutePaths);
      await rm(targetPath, {
        recursive: args.recursive ?? true,
        force: true,
      });

      return `OK: deleted ${args.path}`;
    },
  };

  const fsListDirTool: Tool = {
    name: 'fs_list_dir',
    description: 'List files and directories under a path.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list.', default: '.' },
      },
    },
    async execute(args: { path?: string }): Promise<string> {
      const inputPath = args?.path || '.';
      const dirPath = normalizePath(inputPath, rootDir, allowAbsolutePaths);
      const entries = await readdir(dirPath);

      const rows: string[] = [];
      for (const name of entries) {
        const fullPath = resolve(dirPath, name);
        const meta = await stat(fullPath);
        rows.push(`${meta.isDirectory() ? 'dir ' : 'file'} ${name}`);
      }

      return rows.join('\n') || '(empty)';
    },
  };

  const bashTool: Tool = {
    name: 'bash',
    description: 'Run a bash command and return stdout/stderr.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Bash command to execute.' },
        cwd: { type: 'string', description: 'Working directory for command execution.' },
        timeoutMs: { type: 'number', description: 'Execution timeout in milliseconds.' },
      },
      required: ['command'],
    },
    async execute(args: { command?: string; cwd?: string; timeoutMs?: number }): Promise<string> {
      if (!args?.command) {
        throw new Error('Missing required argument: command');
      }

      const cwd = args.cwd
        ? normalizePath(args.cwd, rootDir, allowAbsolutePaths)
        : rootDir;

      const timeout = args.timeoutMs ?? defaultTimeout;

      try {
        const { stdout, stderr } = await exec(`bash -lc ${JSON.stringify(args.command)}`, {
          cwd,
          timeout,
          maxBuffer: 2 * 1024 * 1024,
        });

        return [
          stdout ? `stdout:\n${stdout}` : 'stdout:\n',
          stderr ? `stderr:\n${stderr}` : 'stderr:\n',
        ].join('\n');
      } catch (error: unknown) {
        const err = error as { stdout?: string; stderr?: string; code?: number | string };
        const code = err.code ?? 'unknown';
        const stdout = err.stdout || '';
        const stderr = err.stderr || '';
        const message = getErrorMessage(error);

        return [
          `exit_code: ${code}`,
          `error: ${message}`,
          `stdout:\n${stdout}`,
          `stderr:\n${stderr}`,
        ].join('\n');
      }
    },
  };

  return [fsReadFileTool, fsWriteFileTool, fsDeletePathTool, fsListDirTool, bashTool];
}

export function createDefaultCoreTools(): Tool[] {
  return createCoreTools();
}





