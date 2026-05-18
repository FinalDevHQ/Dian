import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { zip } from "fflate";

/**
 * 递归读取目录内容，返回路径 → Uint8Array 映射
 */
async function collectFiles(dir: string): Promise<Record<string, Uint8Array>> {
  const result: Record<string, Uint8Array> = {};

  async function walk(current: string, prefix: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(fullPath, key);
      } else {
        const st = await stat(fullPath);
        if (st.isFile()) {
          const buf = await readFile(fullPath);
          result[key] = new Uint8Array(buf);
        }
      }
    }
  }

  await walk(dir, "");
  return result;
}

/**
 * 将目录打包为 base64 编码的 zip
 */
export async function packDirToBase64(dir: string): Promise<string> {
  const files = await collectFiles(dir);

  const zipped = await new Promise<Uint8Array>((res, rej) => {
    zip(files, { level: 6 }, (err, data) => {
      if (err) rej(err);
      else res(data);
    });
  });

  return Buffer.from(zipped).toString("base64");
}
