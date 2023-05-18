import { Request, NextFunction, Response } from 'express';

export interface ThirdwebRequest extends Request {
  context: {
    apiKeyCreatorWalletAddress?: string;
  };
}

export const thirdwebContext = () => {
  return function (req: Request, res: Response, next: NextFunction) {
    (req as ThirdwebRequest).context = {};
    next();
  };
};
