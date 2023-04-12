import { Client as W3UpClient } from '@web3-storage/w3up-client';
import { ShardStoringStream, Upload } from '@web3-storage/upload-client';
import { Store as StoreCapabilities, Upload as UploadCapabilities } from '@web3-storage/capabilities'
import { ShardingStream } from '@web3-storage/upload-client';

export class ThirdwebW3UpClient extends W3UpClient {
  /**
   * @param {import('./types').UploadDirectoryOptions} [options]
   */
  async getConf(options = {}) {
    const conf = await this._invocationConfig([
      StoreCapabilities.add.can,
      UploadCapabilities.add.can,
    ])
    options.connection = this._serviceConf.upload
    return conf
  }
}

export async function uploadBlockStream(conf, blocks, options = {}) {
  /** @type {import('./types').CARLink[]} */
  const shards = []
  /** @type {import('./types').AnyLink?} */
  let root = null
  await blocks
    .pipeThrough(new ShardingStream(options))
    .pipeThrough(new ShardStoringStream(conf, options))
    .pipeTo(
      new WritableStream({
        write(meta) {
          root = root || meta.roots[0]
          shards.push(meta.cid)
          if (options.onShardStored) options.onShardStored(meta)
        },
      })
    )

  /* c8 ignore next */
  if (!root) throw new Error('missing root CID')

  await Upload.add(conf, root, shards, options)
  return root
}