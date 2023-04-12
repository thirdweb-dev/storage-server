import './loadEnv';
import 'reflect-metadata';
import express from 'express';
import dataSource from './ormconfig';
import { Client as W3UpClient } from '@web3-storage/w3up-client';
import { createWriter } from '@ipld/unixfs'
import busboy from 'busboy'
import nodeStream from 'node:stream';
import events from 'node:events';
import { AgentData } from '@web3-storage/access/agent'
import * as Signer from '@ucanto/principal/ed25519'
import { CarReader } from '@ipld/car'
import { importDAG } from '@ucanto/core/delegation'
import { Block } from '@ipld/car/reader';
import PQueue from 'p-queue';
import cors from 'cors'
import * as CAR from '@web3-storage/upload-client/car'
import { AnyLink, DirectoryEntryLink } from '@web3-storage/upload-client/dist/src/types';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { FileWriter } from './w3s-incremental-dir-upload/upload-client-unixfs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ThirdwebW3UpClient, uploadBlockStream } from './w3s-incremental-dir-upload/upload-client-additions';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as UnixFS from './w3s-incremental-dir-upload/upload-client-unixfs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// import { UnixFS } from './w3s-incremental-dir-upload/upload-client-unixfs';

events.setMaxListeners(1000)

const app = express();
const port = process.env.PORT || 3000;

let client!: ThirdwebW3UpClient;

if (process.env.NODE_ENV === 'development') {
  app.use(cors())
}

app.post('/uploads',  async (req, res) => {
  // Allow a long time for uploads
  req.setTimeout(360000000)

  const bb = busboy({ headers: req.headers, preservePath: true })
  const workQueue = new PQueue({ concurrency: 1 });

  function abort(e: Error) {
    req.unpipe(bb);
    workQueue.pause();
    if (!req.aborted) {
      res.set("Connection", "close");
      // TODO: Surface user errors as Bad Request, all other errors as Internal Server Error
      res.status(500).send(e.message);
    }
  }

  async function abortOnError(fn: any) {
    workQueue.add(async () => {
      try {
        await fn();
      } catch (e: any) {
        console.error(e)
        abort(e);
      }
    });
  }

  // Track when the form is done parsing
  let formDone = false;

  // Store data needed for directory uploads
  let directoryUploadState: any | undefined = undefined
  const directoryUploadOptions = {}
  const directoryUploadConf = await client.getConf(directoryUploadOptions)

  bb.on('file', async (_, file, info) => {
    abortOnError(async () => {
      const { filename: filePath, encoding, mimeType } = info;
      console.log(
        `File: filePath: %j, encoding: %j, mimeType: %j`,
        filePath,
        encoding,
        mimeType,
        info
      );

      file
        .on('close', async () => {
          console.log(`File [${filePath}] done`);
        });

      // When uploading a single file, the client sends a filename of "files". A little counterintuitive, but we need to handle it
      if (filePath !== 'files' && !filePath.startsWith('files/')) {
        throw new Error(`Invalid file name: ${name}. Must be "files" for a single file upload, or "files/{name}" for a directory upload (note the 's' in "files")`)
      }

      const isPartOfDirectory = filePath.startsWith('files/');
      if (isPartOfDirectory) {
        // If the filename variable doesn't include a filename (e.g., it's just "files/"), we need to throw an error letting the user know that they need to include a filename
        if (filePath === 'files/') {
          throw new Error(`Invalid file name: it cannot be blank. When uploading a file part of a directory, you must include a filename for each file (e.g. "files/my-file.txt")`)
        }

        // Upload the individual file needed for the directory upload
        console.log('Starting upload of file in directory...')

        // let carCID!: any
        // const dataCID = await client.uploadWith(
        //   async (writer: any) => {
        //     console.log('writing')
        //     const onetxt = writer.createFile("lol/lol.txt")
        //     onetxt.write(new TextEncoder().encode("sdfsdfsfsd"))
        //     await onetxt.close()
        //   },
        //   {
        //     onShardStored: (meta: any) => {
        //       carCID = meta.cid
        //     },
        //   }
        // )

        const finalFilePath = filePath.replace('files/', '')

        let w3sFile: FileWriter | undefined
        file.on('data', async (data: any) => {
          console.log('data', data.length)
          if (!directoryUploadState) {
            console.log('opening')
            const channel = UnixFS.createUploadChannel()
            directoryUploadState = {
              channel,
              writer: UnixFS.createDirectoryWriter(channel),
              result: uploadBlockStream(directoryUploadConf, channel.readable, directoryUploadOptions),
            }
            // console.log('created state', directoryUploadState)
          }
          if (!w3sFile) {
            w3sFile = directoryUploadState.writer.createFile(finalFilePath)
            // console.log('created file writer', w3sFile)
          }
          console.log('writing')
          w3sFile.write(data)
        })
        file
          .on('close', async () => {
            console.log(`file closed`);
            await w3sFile.close()
            if (formDone) {
              console.log('closing directory upload 1')
              await directoryUploadState.writer.close()
              await directoryUploadState.channel.writer.close()
              const dataCID = await directoryUploadState.result;
              console.log('carCID', dataCID.toString())
              directoryUploadState = undefined
              res.json({
                IpfsHash: dataCID.toString(),
              })
            }
          });

        console.timeEnd('Upload took')
        // console.log('got entries', entries)

      } else {
        console.log('Starting upload of individual file...')
        console.time('Upload took')
        const cid = await client.uploadFile({
          stream: () => nodeStream.Readable.toWeb(file) as any,
        });
        console.timeEnd('Upload took')

        res.json({
          IpfsHash: cid.toString(),
        })
      }

      // // Track the upload
      // const upload = new UploadEntity();
      // // upload.uploaderId = userId;
      // await upload.save();
      //
      // res.json(upload);

    })
  });
  bb.on('field', (name, val) => {
    console.log(`Field [${name}]: value: %j`, val);
  });
  bb.on('close', async () => {
    console.log('Done parsing form!');

    formDone = true;

    if (directoryUploadState) {
      console.log('closing directory upload 2')
      await directoryUploadState.writer.close()
      await directoryUploadState.channel.writer.close()
      const dataCID = await directoryUploadState.result;
      console.log('carCID', dataCID.toString())
      directoryUploadState = undefined
      res.json({
        IpfsHash: dataCID.toString(),
      })
    }
  });

  req.on("aborted", abort);
  bb.on("error", abort);

  req.pipe(bb);
});

dataSource
  .initialize()
  .then(async () => {
    const server = app.listen(port, async () => {
      const principal = Signer.parse(process.env.W3UP_KEY as string)
      const data = await AgentData.create({ principal })
      client = new ThirdwebW3UpClient(data as any)

      const proof = await parseProof(process.env.W3UP_PROOF as string)
      const space = await client.addSpace(proof)
      await client.setCurrentSpace(space.did() as `did:key:${string}`)

      console.log(`Server listening on port ${port}`);
    });
    server.setTimeout(360000000)
  });

/** @param {string} data Base64 encoded CAR file */
async function parseProof (data: string) {
  const blocks: Block[] = []
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'))
  for await (const block of reader.blocks()) {
    blocks.push(block)
  }
  return importDAG(blocks as any)
}

async function uploadDir (client: W3UpClient, entries: DirectoryEntryLink[]): Promise<AnyLink> {
  const { readable, writable } = new TransformStream({})
  const unixfsWriter = createWriter({ writable })
  const dirWriter = unixfsWriter.createDirectoryWriter()
  for (const entry of entries) {
    // @ts-expect-error
    dirWriter.set(entry.name, entry)
  }
  await dirWriter.close()
  unixfsWriter.close()

  const blocks: any[] = []
  await readable.pipeTo(new WritableStream({ write: b => { blocks.push(b) } }))
  const car = await CAR.encode(blocks)

  console.log('Uploading directory CAR...')
  console.time('Directory CAR upload took')
  const cid = await client.uploadCAR(car)
  console.timeEnd('Directory CAR upload took')

  return cid
}