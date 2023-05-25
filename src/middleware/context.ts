import { Request, NextFunction, Response } from 'express';
import { CREATOR_WALLET_ADDRESS_WHILE_API_SERVER_IS_DOWN } from '../constants/apiKeys';

export interface ThirdwebRequest extends Request {
  context: {
    apiKeyCreatorWalletAddress: string;
  };
}

export const thirdwebContext = () => {
  return function (req: Request, res: Response, next: NextFunction) {
    (req as ThirdwebRequest).context = {
      apiKeyCreatorWalletAddress:
        CREATOR_WALLET_ADDRESS_WHILE_API_SERVER_IS_DOWN,
    };
    next();
  };
};
