export type StoredFile = {
  storageKey: string;
  sizeBytes: number;
};

export interface StorageService {
  save(params: {
    originalName: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StoredFile>;

  read(storageKey: string): Promise<Buffer>;

  /** Removes a stored object by opaque key. Missing keys are ignored. */
  remove(storageKey: string): Promise<void>;
}
