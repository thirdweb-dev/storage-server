import { getEnv } from './loadEnv';
import httpProxy from 'http-proxy';
import express from 'express';
import cors from 'cors';

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

// TODO: Validate API key and extract user

app.post('/ipfs/upload', async (req, res) => {
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

  proxy.web(req, res, {
    target: 'https://api.pinata.cloud',
    changeOrigin: true,
  });
});

app.listen(port, () => {
  console.log(`Now listening on port ${port}...`);
});
