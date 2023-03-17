import "./loadDotenv"
import "reflect-metadata";
import express from "express";
import bodyParser from "body-parser";
import dataSource from './ormconfig'
import { UploadEntity } from "./entities/UploadEntity";

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post("/uploads", async (req, res) => {
    const { userId } = req.body;

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
  })