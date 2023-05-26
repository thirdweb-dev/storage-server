import * as UnixFS from '@ipld/unixfs';
// import { TransformStream } from 'web-streams-polyfill';
import * as raw from 'multiformats/codecs/raw';
import { withMaxChunkSize } from '@ipld/unixfs/file/chunker/fixed';
import { withWidth } from '@ipld/unixfs/file/layout/balanced';
import { TransformStream } from 'node:stream/web';

const SHARD_THRESHOLD = 1000; // shard directory after > 1,000 items
const queuingStrategy = UnixFS.withCapacity();

const settings = UnixFS.configure({
  fileChunkEncoder: raw,
  smallFileEncoder: raw,
  chunker: withMaxChunkSize(1024 * 1024),
  fileLayout: withWidth(1024),
});

/**
 * @typedef {{
 *  readable: ReadableStream<import('@ipld/unixfs').Block>
 *  writable: WritableStream<import('@ipld/unixfs').Block>
 *  writer: import('@ipld/unixfs').View
 * }} UploadChannel
 */

/**
 * Create a new upload channel that can be used to write UnixFS files and
 * directories.
 *
 * @param {QueuingStrategy} [strategy]
 * @returns {UploadChannel}
 */
export const createUploadChannel = (strategy = queuingStrategy) => {
  const { readable, writable } = new TransformStream({}, strategy);
  const writer = UnixFS.createWriter({ writable, settings });
  return { readable, writable, writer };
};

/**
 * @param {object} options
 * @param {import('@ipld/unixfs').View} options.writer
 */
export const createDirectoryWriter = (options) => new DirectoryWriter(options);

export class FileWriter {
  /**
   * @param {object} options
   * @param {import('@ipld/unixfs').View} options.writer
   */
  constructor({ writer }) {
    this.writer = UnixFS.createFileWriter(writer);
  }
  /**
   * @param {Uint8Array} chunk
   */
  write(chunk) {
    return this.writer.write(chunk);
  }
  close() {
    if (this.result) {
      return this.result;
    } else {
      return (this.result = this.writer.close());
    }
  }
}

class DirectoryWriter {
  /**
   * @param {object} options
   * @param {import('@ipld/unixfs').View} options.writer
   */
  constructor({ writer }) {
    this.writer = writer;
    /** @type {Map<string, DirectoryWriter|FileWriter>} */
    this.entries = new Map();
  }

  /**
   * @param {string} path
   */
  createDirectory(path) {
    /** @type {DirectoryWriter} */
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let directory = this;
    const at = [];
    for (const name of path.split('/')) {
      if (name !== '' && name !== '.') {
        at.push(name);
        let writer = directory.entries.get(name);
        if (writer == null) {
          writer = new DirectoryWriter(this);
          directory.entries.set(name, writer);
        }

        if (!(writer instanceof DirectoryWriter)) {
          throw new Error(
            `Can not create directory at ${at.join(
              '/'
            )}, because there is a file with the same name`
          );
        }

        directory = writer;
      }
    }
    return directory;
  }

  /**
   * @param {string} path
   */
  createFile(path) {
    const parts = path.split('/');
    const name = /** @type {string} */ (parts.pop());
    let directory = this.createDirectory(parts.join('/'));

    if (directory.entries.has(name)) {
      throw new Error(
        `Can not create a file at "${path}" because there is already a file or directory with the same name"`
      );
    }

    const writer = new FileWriter(this);
    directory.entries.set(name, writer);
    return writer;
  }

  async close() {
    const writer =
      this.entries.size <= SHARD_THRESHOLD
        ? UnixFS.createDirectoryWriter(this.writer)
        : UnixFS.createShardedDirectoryWriter(this.writer);

    const promises = [...this.entries].map(async ([name, entry]) => {
      const link = await entry.close();
      writer.set(name, link);
    });

    await Promise.all(promises);
    return await writer.close();
  }
}
