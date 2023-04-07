import './loadEnv';
import 'reflect-metadata';
import express from 'express';
import dataSource from './ormconfig';
import { Client } from '@web3-storage/w3up-client';
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

const app = express();
const port = process.env.PORT || 3000;

let client!: Client;

events.setMaxListeners(1000)

app.use(cors())

// app.use(bodyParser.json());

app.post('/uploads',  async (req, res) => {
  // Allow a long time for uploads
  req.setTimeout(360000000)

  const bb = busboy({ headers: req.headers, preservePath: true })
  const workQueue = new PQueue({ concurrency: 1 });

  function abort(e: Error) {
    console.log('aborted')
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

  // Used to track individual file entry points for a directory upload
  const directoryEntries: DirectoryEntryLink[] = []

  // Track when the form is done parsing
  let formDone = false;

  // Track when a directory upload has begun
  let directoryUploadBegan = false;

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

      if (filePath !== 'file' && !filePath.startsWith('files/')) {
        throw new Error(`Invalid file name: ${name}. Must be "file" for a single file upload, or "files/{name}" for a directory upload (note the 's' in "files")`)
      }

      const isPartOfDirectory = filePath.startsWith('files/');
      if (isPartOfDirectory) {
        // If the filename variable doesn't include a filename (e.g., it's just "files/"), we need to throw an error letting the user know that they need to include a filename
        if (filePath === 'files/') {
          throw new Error(`Invalid file name: it cannot be blank. When uploading a file part of a directory, you must include a filename for each file (e.g. "files/my-file.txt")`)
        }

        // // If the filePath includes multiple slashes (e.g., "files/my-folder/my-file.txt"), we need to throw an error letting the user know that they can only upload one file at a time
        if (filePath.split('/').length > 2) {
          throw new Error(`Invalid file name: ${filePath}. When uploading a file part of a directory, you can not include subdirectories. We will add support for subdirectories very soon.`)
        }

        // Remove the "files/" prefix to get the file's actual name
        const fileName = filePath.slice('files/'.length);

        // Upload the individual file needed for the directory upload
        // TODO: Work with the w3s team to eliminate the need for a directory upload. This should be a single file upload
        console.log('Starting upload of file in directory...')
        console.time('Upload took')
        const entries: DirectoryEntryLink[] = []
        await client.uploadDirectory([
          {
            name: fileName,
            stream: () => nodeStream.Readable.toWeb(file) as any,
          }
        ], { onDirectoryEntryLink: e => entries.push(e) })
        console.timeEnd('Upload took')
        // console.log('got entries', entries)

        // Add the entry to the directoryEntries array
        directoryEntries.push(entries[0])

        // If the form is done parsing, we can upload the directory
        if (formDone && directoryEntries.length && !directoryUploadBegan) {
          console.log('Starting dir upload from file body')
          directoryUploadBegan = true
          const cid = await uploadDir(client, directoryEntries)
          console.log('Directory CID =', cid.toString())
          res.json({
            IpfsHash: cid.toString(),
          })
          console.log('responded')
        }
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

        console.log('CID =', cid.toString())
      }

      // // Track the upload
      // const upload = new UploadEntity();
      // // upload.uploaderId = userId;
      // await upload.save();
      //
      // res.json(upload);

    })
    bb.on('field', (name, val, info) => {
      console.log(`Field [${name}]: value: %j`, val);
    });
    bb.on('close', async () => {
      console.log('Done parsing form!');

      formDone = true;

      // If the form is done parsing, we can upload the directory
      // if (formDone && directoryEntries.length && !directoryUploadBegan) {
      //   console.log('Starting dir upload from handler for done parsing form')
      //   directoryUploadBegan = true
      //   const cid = await uploadDir(client, directoryEntries)
      //   res.json({
      //     IpfsHash: cid.toString(),
      //   })
      // }

      // res.json({ ok: true })
      // res.writeHead(303, { Connection: 'close', Location: '/' });
      // res.end();
    });
  });

  req.on("aborted", abort);
  bb.on("error", abort);

  req.pipe(bb);
});

dataSource
  .initialize()
  .then(() => {
    const server = app.listen(port, async () => {
      const principal = Signer.parse(process.env.W3UP_KEY as string)
      const data = await AgentData.create({ principal })
      client = new Client(data as any)

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

async function uploadDir (client: Client, entries: DirectoryEntryLink[]): Promise<AnyLink> {
  console.log('Creating directory CAR...');
  const { readable, writable } = new TransformStream({})
  const unixfsWriter = createWriter({ writable })
  const dirWriter = unixfsWriter.createDirectoryWriter()
  for (const entry of entries) {
    // @ts-expect-error
    dirWriter.set(entry.name, entry)
  }
  console.log('1')
  await dirWriter.close()
  console.log('2')
  unixfsWriter.close()

  const blocks: any[] = []
  await readable.pipeTo(new WritableStream({ write: b => { blocks.push(b) } }))
  console.log('3')
  const car = await CAR.encode(blocks)

  console.log('Uploading directory CAR...')
  console.time('Directory CAR upload took')
  const cid = await client.uploadCAR(car)
  console.log('4')
  console.timeEnd('Directory CAR upload took')

  return cid
}