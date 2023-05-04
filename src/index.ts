import './loadEnv';
import 'reflect-metadata';
import express from 'express';
import dataSource from './ormconfig';
import busboy from 'busboy';
import nodeStream from 'node:stream';
import events from 'node:events';
import { AgentData } from '@web3-storage/access/agent';
import * as Signer from '@ucanto/principal/ed25519';
import { CarReader } from '@ipld/car';
import { importDAG } from '@ucanto/core/delegation';
import { Block } from '@ipld/car/reader';
import PQueue from 'p-queue';
import cors from 'cors';

// This import is from a file that was intentionally not ported to TypeScript. See w3up-client-patches/README.md.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { FileWriter } from './w3up-client-patches/upload-client-unixfs';

// This import is from a file that was intentionally not ported to TypeScript. See w3up-client-patches/README.md.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {
  ThirdwebW3UpClient,
  uploadBlockStream,
} from './w3up-client-patches/upload-client-additions';

// This import is from a file that was intentionally not ported to TypeScript. See w3up-client-patches/README.md.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as UnixFS from './w3up-client-patches/upload-client-unixfs';
import { getEnv } from './loadEnv';
import apiKeyValidator from './middleware/apiKeyValidator';
import { UploadEntity } from './entities/UploadEntity';
import { AnyLink } from '@web3-storage/upload-client/dist/src/types';

events.setMaxListeners(1000);

const app = express();
const port = Number(getEnv('PORT')) || 3000;

let client!: ThirdwebW3UpClient;

app.use(cors());
app.use(apiKeyValidator());

async function trackUpload(args: {
  apiKey: string;
  isDirectory: boolean;
  cid: AnyLink;
}) {
  const upload = new UploadEntity();
  upload.apiKey = args.apiKey;
  upload.isDirectory = args.isDirectory;
  upload.cid = args.cid.toString();
  await dataSource.manager.save(upload);
}

app.post('/ipfs/upload', async (req, res) => {
  // Allow a long time for uploads
  req.setTimeout(360000000);

  console.log('Starting upload...', req);
  console.dir(req, { depth: null, colors: true });

  const bb = busboy({ headers: req.headers, preservePath: true });
  const workQueue = new PQueue({ concurrency: 1 });

  function abort(e: Error) {
    req.unpipe(bb);
    workQueue.pause();
    if (!req.aborted) {
      res.set('Connection', 'close');
      // TODO: Surface user errors as Bad Request, all other errors as Internal Server Error
      res.status(500).send(e.message);
    }
  }

  async function abortOnError(fn: any) {
    workQueue.add(async () => {
      try {
        await fn();
      } catch (e: any) {
        console.error(e);
        abort(e);
      }
    });
  }

  // Store state data needed for directory uploads
  let directoryUploadState: any | undefined = undefined;
  const directoryUploadOptions = {};
  const directoryUploadConf = await client.getConf(directoryUploadOptions);

  const apiKey = req.get('x-api-key') as string;

  bb.on('file', async (_, file, info) => {
    abortOnError(async () => {
      const { filename: filePath } = info;

      // When uploading a single file, the client sends a filename of "files". A little counterintuitive, but we need to handle it
      if (filePath !== 'files' && !filePath.startsWith('files/')) {
        throw new Error(
          `Invalid file name: ${filePath}. Must be "files" for a single file upload, or "files/{name}" for a directory upload (note the 's' in "files")`
        );
      }

      const isPartOfDirectory = filePath.startsWith('files/');
      if (isPartOfDirectory) {
        // If the filename variable doesn't include a filename (e.g., it's just "files/"), we need to throw an error letting the user know that they need to include a filename
        if (filePath === 'files/') {
          throw new Error(
            `Invalid file name: it cannot be blank. When uploading a file part of a directory, you must include a filename for each file (e.g. "files/my-file.txt")`
          );
        }

        const finalFilePath = filePath.replace('files/', '');
        let w3sFile!: FileWriter;
        file.on('data', async (data: any) => {
          if (!directoryUploadState) {
            const channel = UnixFS.createUploadChannel();
            directoryUploadState = {
              channel,
              writer: UnixFS.createDirectoryWriter(channel),
              result: uploadBlockStream(
                directoryUploadConf,
                channel.readable,
                directoryUploadOptions
              ),
            };
          }
          if (!w3sFile) {
            w3sFile = directoryUploadState.writer.createFile(finalFilePath);
          }
          w3sFile.write(data);
        });

        file.on('close', async () => {
          await w3sFile.close();
        });
      } else {
        const cid = await client.uploadFile({
          stream: () => nodeStream.Readable.toWeb(file) as any,
        });
        await trackUpload({
          cid,
          apiKey: req.headers['x-api-key'] as string,
          isDirectory: false,
        });
        res.json({
          IpfsHash: cid.toString(),
        });
      }
    });
  });
  bb.on('close', async () => {
    if (directoryUploadState) {
      await directoryUploadState.writer.close();
      await directoryUploadState.channel.writer.close();
      const dataCID = await directoryUploadState.result;
      directoryUploadState = undefined;
      await trackUpload({
        cid: dataCID,
        apiKey,
        isDirectory: true,
      });
      res.json({
        IpfsHash: dataCID.toString(),
      });
    }
  });

  req.on('aborted', abort);
  bb.on('error', abort);

  req.pipe(bb);
});

dataSource.initialize().then(async () => {
  const server = app.listen(port, async () => {
    await initW3UpClient();
    console.log(`Server listening on port ${port}`);
  });
  server.setTimeout(360000000);
});

async function initW3UpClient() {
  const principal = Signer.parse(getEnv('W3UP_KEY') as string);
  const data = await AgentData.create({ principal });
  client = new ThirdwebW3UpClient(data as any);
  const proof = await parseProof(getEnv('W3UP_PROOF') as string);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did() as `did:key:${string}`);
}

/** @param {string} data Base64 encoded CAR file */
async function parseProof(data: string) {
  const blocks: Block[] = [];
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'));
  for await (const block of reader.blocks()) {
    blocks.push(block);
  }
  return importDAG(blocks as any);
}
