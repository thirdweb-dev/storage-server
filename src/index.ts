import path from "node:path";
import * as dotenv from 'dotenv'
dotenv.config({
  path: process.env.NODE_ENV === 'development' ? path.resolve(__dirname, '../.env.development') : undefined
})

import "reflect-metadata";
import express from "express";
import bodyParser from "body-parser";
import {DataSource} from "typeorm";
import ormconfig from './ormconfig'
import { Upload } from "./entities/Upload";

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post("/uploads", async (req, res) => {
    const { userId } = req.body;

    const upload = new Upload();
    upload.userId = userId;
    await upload.save();

    res.json(upload);
});

const dataSource = new DataSource(ormconfig)
dataSource
  .initialize()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })