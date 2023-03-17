import path from "node:path";
import * as dotenv from 'dotenv'

dotenv.config({
  path: process.env.NODE_ENV === 'development' ? path.resolve(__dirname, '../.env.development') : undefined
})
