import { Request, Response, NextFunction } from 'express';
import axios, { AxiosResponse } from 'axios';
import { getEnv } from '../loadEnv';

interface ValidationResponse {
  data: {
    authorized: boolean;
  };
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
    try {
      const response: AxiosResponse<ValidationResponse> = await axios.post(
        `${getEnv('THIRDWEB_API_ORIGIN')}/v1/keys/use`,
        {
          body: JSON.stringify({
            scope: 'storage/upload',
          }),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
          },
          validateStatus: function (status) {
            return status < 500; // Resolve only if the status code is less than 500
          },
        }
      );
      if (response.data.error) {
        res
          .status(response.data.error.statusCode)
          .json({ message: response.data.error.message });
        return;
      }
      next();
    } catch (error: any) {
      // TODO: Add alerting here
      console.error(`Error while validating API key: ${error.message}`);
      console.error(
        'The API verification server may be down. The client will be permitted to continue.'
      );
      next();
    }
  };
};

export default apiKeyValidator;
