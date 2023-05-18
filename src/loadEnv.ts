import path from 'node:path';
import * as dotenv from 'dotenv';

const envPath = path.join(path.resolve(), `./.env.${process.env.NODE_ENV}`);

dotenv.config({
  path: envPath,
  debug: true,
});

function getEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export { getEnv };
