import './loadEnv';
import 'reflect-metadata';
import express from 'express';
import dataSource from './ormconfig';
import { Client } from '@web3-storage/w3up-client';
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

const app = express();
const port = process.env.PORT || 3000;

let client!: Client;

events.setMaxListeners(1000)

app.use(cors())

// app.use(bodyParser.json());

app.post('/uploads',  async (req, res) => {
  const bb = busboy({ headers: req.headers })
  const workQueue = new PQueue({ concurrency: 1 });

  function abort() {
    console.log('aborted')
    req.unpipe(bb);
    workQueue.pause();
    if (!req.aborted) {
      res.set("Connection", "close");
      res.sendStatus(413);
    }
  }

  async function abortOnError(fn: any) {
    workQueue.add(async () => {
      try {
        await fn();
      } catch (e) {
        abort();
      }
    });
  }

  bb.on('file', async (name, file, info) => {
    console.log('file incoming');
    abortOnError(async () => {
      const { filename, encoding, mimeType } = info;
      console.log(
        `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
        filename,
        encoding,
        mimeType
      );

      req.setTimeout(360000000)

      file
        .on('data', (data) => {
          console.log(`File [${name}] got ${data.length} bytes`);
          // fileData.push(data)
        })
        .on('close', () => {
          console.log(`File [${name}] done`);
        });

      console.log('started uploading')
      console.time('started uploading')
      const cid = await client.uploadFile({
        stream: () => nodeStream.Readable.toWeb(file) as any,
      });
      console.timeEnd('started uploading')

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
    bb.on('close', () => {
      console.log('Done parsing form!');
      res.json({ ok: true })
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