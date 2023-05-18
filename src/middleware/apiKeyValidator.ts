import { Request, Response, NextFunction } from 'express';
import axios, { AxiosResponse } from 'axios';
import { getEnv } from '../loadEnv';
import { ThirdwebRequest } from './context';

interface ValidationResponse {
  authorized: boolean;
  apiKeyCreatorWalletAddress: string;
  error: {
    message: string;
    statusCode: number;
  };
}

export const apiKeyValidator = () => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const key = req.get('x-api-key');
    const thirdwebRequest = req as ThirdwebRequest;
    console.log(`${getEnv('THIRDWEB_API_ORIGIN')}/v1/keys/use`, key);
    try {
      const response: AxiosResponse<ValidationResponse> = await axios.post(
        `${getEnv('THIRDWEB_API_ORIGIN')}/v1/keys/use`,
        {
          scope: 'storage.upload',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
          },
        }
      );
      if (response.data.error) {
        res
          .status(response.data.error.statusCode)
          .json({ message: response.data.error.message });
        return;
      }
      thirdwebRequest.context.apiKeyCreatorWalletAddress =
        response.data.apiKeyCreatorWalletAddress;
      next();
    } catch (error: any) {
      // TODO: Add alerting here
      console.error(`Error while validating API key: ${error}`);
      console.error(
        'The API verification server may be down. The client will be permitted to continue.'
      );
      next();
    }
  };
};

export default apiKeyValidator;
