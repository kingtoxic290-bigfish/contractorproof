import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalFilesystemStorageService } from "../src/services/storage/LocalFilesystemStorageService";

describe("LocalFilesystemStorageService", () => {
  let storageDir = "";

  afterEach(async () => {
    if (storageDir) {
      await rm(storageDir, { recursive: true, force: true });
      storageDir = "";
    }
  });

  it("stores under an opaque key and ignores path traversal on read", async () => {
    storageDir = await mkdtemp(path.join(os.tmpdir(), "cp-storage-"));
    const storage = new LocalFilesystemStorageService(storageDir);
    const stored = await storage.save({
      originalName: "../../../etc/passwd.jpg",
      buffer: Buffer.from("opaque-bytes"),
      mimeType: "image/jpeg",
    });

    expect(stored.storageKey).toMatch(/^[0-9a-f-]{36}\.jpg$/i);
    expect(stored.storageKey).not.toContain("..");
    expect(stored.storageKey).not.toContain("/");

    const read = await storage.read(`../../${stored.storageKey}`);
    expect(read.equals(Buffer.from("opaque-bytes"))).toBe(true);
  });
});
