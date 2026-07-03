import type { OkfProjection } from "@nudge/effect-services";

export interface OkfSandbox {
  readonly deletePrefix?: (prefix: string) => Promise<unknown>;
  readonly exec: (
    command: string,
    options?: { readonly cwd?: string; readonly timeout?: number },
  ) => Promise<{
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: string;
    readonly success: boolean;
  }>;
  readonly mkdir: (path: string, options?: { readonly recursive?: boolean }) => Promise<unknown>;
  readonly mountBucket?: (
    bucket: string,
    mountPath: string,
    options: { readonly prefix: string; readonly readOnly: boolean },
  ) => Promise<unknown>;
  readonly putObject?: (key: string, content: string) => Promise<unknown>;
  readonly writeFile: (path: string, content: string) => Promise<unknown>;
}

export const materializeOkfProjection = async (
  sandbox: OkfSandbox,
  projection: OkfProjection,
  root = "/workspace/okf",
) => {
  if (sandbox.deletePrefix && sandbox.mountBucket && sandbox.putObject) {
    const prefix = okfObjectPrefix(projection);
    await sandbox.deletePrefix(prefix);
    await Promise.all(
      [...projection.files.entries()].map(([path, content]) =>
        sandbox.putObject?.(`${prefix}${path.slice(1)}`, content),
      ),
    );
    await sandbox.mountBucket("OKF_FILES", root, { prefix: `/${prefix}`, readOnly: true });
    return;
  }

  await sandbox.mkdir(root, { recursive: true });
  const cleanup = await sandbox.exec(clearDirectoryCommand, { cwd: root, timeout: 10_000 });
  if (!cleanup.success) {
    throw new Error(cleanup.stderr || "Failed to clear OKF sandbox root");
  }
  await Promise.all(
    [...projection.files.entries()].map(async ([path, content]) => {
      const target = `${root}${path}`;
      const parent = target.slice(0, target.lastIndexOf("/")) || root;
      await sandbox.mkdir(parent, { recursive: true });
      await sandbox.writeFile(target, content);
    }),
  );
};

export const smokeTestOkfProjection = async (
  sandbox: OkfSandbox,
  projection: OkfProjection,
  root = "/workspace/okf",
) => {
  await materializeOkfProjection(sandbox, projection, root);
  const result = await sandbox.exec('find . -type f | sort && grep -R "type:" daily memory', {
    cwd: root,
    timeout: 10_000,
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr,
    stdout: result.stdout,
    success: result.success,
  };
};

const okfObjectPrefix = (projection: OkfProjection) => {
  return `okf/${encodeURIComponent(projection.userId)}/`;
};

const clearDirectoryCommand = `python - <<'PY'
import os
import shutil

for name in os.listdir("."):
    path = os.path.join(".", name)
    if os.path.isdir(path) and not os.path.islink(path):
        shutil.rmtree(path)
    else:
        os.unlink(path)
PY`;
