import path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({
  path:
    process.env.NODE_ENV === 'development'
      ? path.join(path.resolve(), './.env.development')
      : undefined,
});

function getEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export { getEnv };
