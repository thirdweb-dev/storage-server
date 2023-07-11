import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

function getEnv(key: string) {
  return process.env[key];
}

export { requireEnv, getEnv };
