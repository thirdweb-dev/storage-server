import { apiKeyValidator } from './middleware/apiKeyValidator';
import { errorHandler } from './middleware/error';
import { handler } from './utils/handler';
import { getEnv, requireEnv } from './utils/env';
import httpProxy from 'http-proxy';
import express from 'express';
import cors from 'cors';
import { prisma } from './utils/prisma';

const app = express();
const proxy = httpProxy.createProxyServer({
  secure: false,
});
const port = Number(getEnv('PORT') || 3000);

app.use(
  cors({
    origin: true,
  })
);

app.use(apiKeyValidator());

app.post(
  '/ipfs/upload',
  handler(async (req, res) => {
    console.log(req.url, req.headers, req.ip, req.method, req.body);

    // Save the API key in advance to store in database
    const apiKey: string | undefined = res.locals.apiKey;

    proxy.on('proxyRes', (proxyRes) => {
      const bodyChunks: any[] = [];
      proxyRes.on('data', (chunk) => {
        bodyChunks.push(chunk);
      });

      proxyRes.on('end', async () => {
        const body = JSON.parse(Buffer.concat(bodyChunks).toString());
        const cid = body.IpfsHash as string;

        if (cid) {
          await prisma.uploads.create({
            data: {
              cid,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              apiKey: apiKey || '',
            },
          });
        }
      });
    });

    req.url = '/pinning/pinFileToIPFS';
    req.headers.host = 'api.pinata.cloud';

    // Set authorization headers for pinata request
    req.headers.authorization = '';
    req.headers.pinata_api_key = requireEnv('PINATA_API_KEY');
    req.headers.pinata_secret_api_key = requireEnv('PINATA_SECRET_API_KEY');

    proxy.web(req, res, {
      target: 'https://api.pinata.cloud',
      changeOrigin: true,
    });
  })
);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Now listening on port ${port}...`);
});
