import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { env } from "../../config/env";
import type { StorageService, StoredFile } from "./StorageService";

export class LocalFilesystemStorageService implements StorageService {
  constructor(private readonly rootDir: string = env.storagePath) {}

  async save(params: {
    originalName: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StoredFile> {
    await mkdir(this.rootDir, { recursive: true });
    const baseName = path.basename(
      String(params.originalName ?? "").replaceAll("\0", "").replaceAll("\\", "/"),
    );
    const rawExtension = path.extname(baseName).toLowerCase();
    const extension = /^\.[a-z0-9]{1,10}$/.test(rawExtension) ? rawExtension : "";
    const storageKey = `${randomUUID()}${extension}`;
    const destination = path.join(this.rootDir, storageKey);
    const root = path.resolve(this.rootDir);
    const resolved = path.resolve(destination);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error("invalid storage destination");
    }
    await writeFile(destination, params.buffer);
    return {
      storageKey,
      sizeBytes: params.buffer.length,
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    const destination = path.join(this.rootDir, path.basename(storageKey));
    return readFile(destination);
  }

  async remove(storageKey: string): Promise<void> {
    const destination = path.join(this.rootDir, path.basename(storageKey));
    try {
      await unlink(destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export const localStorageService = new LocalFilesystemStorageService();
