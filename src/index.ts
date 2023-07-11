import { apiKeyValidator } from './middleware/apiKeyValidator';
import { handler } from './utils/handler';
import { getEnv } from './loadEnv';
import httpProxy from 'http-proxy';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';

const app = express();
const proxy = httpProxy.createProxyServer({
  secure: false,
});
const port = Number(getEnv('PORT')) || 3000;

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

    proxy.on('proxyRes', (proxyRes) => {
      const bodyChunks: any[] = [];
      proxyRes.on('data', function (chunk) {
        bodyChunks.push(chunk);
      });
      proxyRes.on('end', function () {
        const body = JSON.parse(Buffer.concat(bodyChunks).toString());
        const cid = body.IpfsHash;
        console.log('CID:', cid);
      });
    });

    req.url = '/pinning/pinFileToIPFS';
    req.headers.host = 'api.pinata.cloud';

    // Set authorization headers for pinata request
    req.headers.authorization = '';
    req.headers.pinata_api_key = getEnv('PINATA_API_KEY');
    req.headers.pinata_secret_key = getEnv('PINATA_SECRET_KEY');

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
