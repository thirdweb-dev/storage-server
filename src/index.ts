// require('fix-esm').register()

import './loadEnv';
import 'reflect-metadata';
import express from 'express';
import bodyParser from 'body-parser';
import dataSource from './ormconfig';
import { UploadEntity } from './entities/UploadEntity';
import multer from 'multer';
// const { create } = require('@web3-storage/w3up-client');
import { create } from '@web3-storage/w3up-client'

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const upload = multer();

app.put('/uploads', upload.array('files'), async (req, res) => {
  const { userId } = req.body;

  const files = (req.files || []) as any as File[]

  console.log('files', files)

  const client = await create()
  const space = await client.createSpace('thirdweb-awesome-space')
  await client.setCurrentSpace(space.did())

  // try {
  //   await client.registerSpace('danny@thirdweb.com')
  // } catch (err) {
  //   console.error('registration failed: ', err)
  // }

  console.time('Upload')
  const directoryCid = await client.uploadDirectory(files)
  console.log('directoryCid', directoryCid)
  console.timeEnd('Upload')

  // Track the upload
  const upload = new UploadEntity();
  upload.uploaderId = userId;
  await upload.save();

  res.json(upload);
});

dataSource
  .initialize()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  });