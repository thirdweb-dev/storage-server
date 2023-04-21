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
    const key = req.get('x-api-key') || 'abcdefg';
    if (!key) {
      res.status(400).json({ message: 'Please provide x-api-key.' });
      return;
    }
    try {
      const response: AxiosResponse<ValidationResponse> = await axios.post(
        `${getEnv('THIRDWEB_API_URL')}/api/keys/use`
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
        'The client will be permitted to continue. This is a big problem. Please fix the error.'
      );
      next();
    }
  };
};

export default apiKeyValidator;
