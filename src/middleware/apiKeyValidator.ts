import { Request, Response, NextFunction } from 'express';
import axios, { AxiosResponse } from 'axios';
import { getEnv } from '../loadEnv';

interface ValidationResponse {
  usable: boolean;
}

const apiKeyValidator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const key = req.get('x-api-key');
  if (!key) {
    res.status(400).json({ message: 'Please provide x-api-key.' });
    return;
  }
  try {
    const response: AxiosResponse<ValidationResponse> = await axios.post(
      `${getEnv('THIRDWEB_API_URL')}/api/keys/use`,
      { key }
    );
    if (response.data.usable) {
      next();
    } else {
      res.status(403).json({ message: 'Invalid API key.' });
    }
  } catch (error: any) {
    console.error(`Error while validating API key: ${error.message}`);
    console.error(
      'The client will be permitted to continue. This is a big problem. Please fix the error.'
    );
    next();
  }
};

export default apiKeyValidator;