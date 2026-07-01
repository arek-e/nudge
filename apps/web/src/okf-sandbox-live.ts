import type { LocalMountBucketOptions } from "@cloudflare/sandbox";
import type { OkfSandbox } from "./okf-sandbox";
import type { LaresOkfSandboxFactoryInput } from "./Services/LaresApp";

const localBucketOptions = { localBucket: true } satisfies LocalMountBucketOptions;

export async function defaultOkfSandboxFactory(
  input: LaresOkfSandboxFactoryInput,
): Promise<OkfSandbox | null> {
  if (!input.env.OKF_SANDBOX) return null;
  const okfFiles = input.env.OKF_FILES;
  const { getSandbox } = await import("@cloudflare/sandbox");
  const sandbox = getSandbox(input.env.OKF_SANDBOX, `okf-${input.user.id}`);
  return {
    ...(okfFiles
      ? {
          deletePrefix: (prefix: string) => deleteR2Prefix(okfFiles, prefix),
          mountBucket: (bucket, mountPath, options) =>
            sandbox.mountBucket(bucket, mountPath, {
              ...options,
              ...(input.env.ENVIRONMENT === "local" ? localBucketOptions : {}),
            }),
          putObject: (key: string, content: string) =>
            okfFiles.put(key, content, {
              httpMetadata: { contentType: "text/markdown; charset=utf-8" },
            }),
        }
      : {}),
    exec: (command, options) => sandbox.exec(command, options),
    mkdir: (path, options) => sandbox.mkdir(path, options),
    writeFile: (path, content) => sandbox.writeFile(path, content),
  } satisfies OkfSandbox;
}

async function deleteR2Prefix(bucket: R2Bucket, prefix: string, cursor?: string): Promise<void> {
  const page = await bucket.list(cursor ? { cursor, prefix } : { prefix });
  const keys = page.objects.map((object) => object.key);
  if (keys.length > 0) await bucket.delete(keys);
  if (page.truncated) await deleteR2Prefix(bucket, prefix, page.cursor);
}
