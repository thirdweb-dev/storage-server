import path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: process.env.NODE_ENV === 'development' ? path.join(path.resolve(), './.env.development') : undefined
});

export {}