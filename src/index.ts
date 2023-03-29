import './loadEnv';
import 'reflect-metadata';
import express from 'express';
// import bodyParser from 'body-parser';
import dataSource from './ormconfig';
import { UploadEntity } from './entities/UploadEntity';
import { Client, create } from '@web3-storage/w3up-client';
import busboy from 'busboy'
import stream from 'node:stream/web';
import nodeStream from 'node:stream';
import events from 'node:events';


const app = express();
const port = process.env.PORT || 3000;

let client!: Client;

events.setMaxListeners(1000)

// app.use(bodyParser.json());

app.put('/uploads',  async (req, res) => {
  const bb = busboy({ headers: req.headers })

  bb.on('file', async (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    console.log(
      `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
      filename,
      encoding,
      mimeType
    );

    req.setTimeout(360000000)

    const entity = new UploadEntity()
    console.log(entity)

    file.on('data', (data) => {
      console.log(`File [${name}] got ${data.length} bytes`);
    }).on('close', () => {
      console.log(`File [${name}] done`);
    });

    console.log('started uploading')
    console.time('started uploading')
    const did = await client.uploadFile({
      stream: () => nodeStream.Readable.toWeb(file) as any,
    });
    console.timeEnd('started uploading')
    console.log('did', did)

    // // Track the upload
    // const upload = new UploadEntity();
    // // upload.uploaderId = userId;
    // await upload.save();
    //
    // res.json(upload);
  });
  bb.on('field', (name, val, info) => {
    console.log(`Field [${name}]: value: %j`, val);
  });
  bb.on('close', () => {
    console.log('Done parsing form!');
    res.writeHead(303, { Connection: 'close', Location: '/' });
    res.end();
  });
  req.pipe(bb);
});

dataSource
  .initialize()
  .then(() => {
    const server = app.listen(port, async () => {
      client = await create()
      await client.authorize('danny@thirdweb.com')
      const space = await client.createSpace('thirdweb-awesome-space')
      await client.setCurrentSpace(space.did() as `did:key:${string}`)
      try {
        await client.registerSpace('danny@thirdweb.com')
      } catch (err) {
        console.error('registration failed: ', err)
      }

      console.log(`Server listening on port ${port}`);
    });
    server.setTimeout(360000000)
  });