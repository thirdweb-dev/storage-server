import './loadEnv';
import 'reflect-metadata';
import express from 'express';
// import bodyParser from 'body-parser';
import dataSource from './ormconfig';
// import { UploadEntity } from './entities/UploadEntity';
import { create } from '@web3-storage/w3up-client'
import busboy from 'busboy'
import stream from 'node:stream';
import { UploadEntity } from './entities/UploadEntity';
import { randomUUID } from 'crypto';


const app = express();
const port = process.env.PORT || 3000;

// app.use(bodyParser.json());

app.put('/uploads',  async (req, res) => {
  // const { userId } = req.body;

  const client = await create()
  const space = await client.createSpace('thirdweb-awesome-space')
  await client.setCurrentSpace(space.did())

  // try {
  //   await client.registerSpace('danny@thirdweb.com')
  // } catch (err) {
  //   console.error('registration failed: ', err)
  // }

  const bb = busboy({ headers: req.headers })

  bb.on('file', async (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    console.log(
      `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
      filename,
      encoding,
      mimeType
    );

    file.on('data', (data) => {
      console.log(`File [${name}] got ${data.length} bytes`);
    }).on('close', () => {
      console.log(`File [${name}] done`);
    });

    await client.uploadFile({
      stream: () => stream.Readable.toWeb(file) as ReadableStream<any>
    })


    // Track the upload
    const upload = new UploadEntity();
    // upload.uploaderId = userId;
    upload.uploaderId = randomUUID()
    await upload.save();

    res.json(upload);
  });
  bb.on('field', (name, val, info) => {
    console.log(`Field [${name}]: value: %j`, val);
  });
  bb.on('close', () => {
    console.log('Done parsing form!');
    res.writeHead(303, { Connection: 'close', Location: '/' });
    res.end();
  });
});

dataSource
  .initialize()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  });