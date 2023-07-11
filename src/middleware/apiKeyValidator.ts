import { Request, Response, NextFunction } from 'express';
import { requireEnv } from '../utils/env';

interface ValidationResponse {
  authorized: boolean;
  data: ApiKey;
  error: {
    message: string;
    statusCode: number;
  };
}

type ApiKey = {
  id: string;
  key: string;
  walletAddresses: string[];
  domains: string[];
  services?: [
    {
      name: string;
      targetAddresses: string[];
      actions: string[];
    }
  ];
};

const scope = 'storage';
const scopeAction = 'write';

export const apiKeyValidator = () => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.headers.authorization) {
      next();
      return;
    }

    try {
      const response = await fetch(
        `${requireEnv('THIRDWEB_API_ORIGIN')}/v1/keys/use`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization || '',
          },
          body: JSON.stringify({
            scope,
          }),
        }
      );

      const data = (await response.json()) as ValidationResponse;

      if (!response.ok) {
        res.status(data.error.statusCode).json({ message: data.error.message });
        return;
      }

      const authKeyData = data.data;

      // validate domains
      if (authKeyData?.domains) {
        const origin = req.headers['Origin'];
        let originHost = '';

        if (origin) {
          try {
            const originUrl = new URL(origin as string);
            originHost = originUrl.host;
          } catch (error) {
            // ignore, will be verified by domains
          }
        }

        if (
          // find matching domain, or if all domains allowed
          !authKeyData.domains.find((d) => d === '*' || originHost === d)
        ) {
          res.status(403).json({
            authorized: false,
            errorMessage: `The domain ${originHost} is not authorized for this key.`,
            errorCode: 'DOMAIN_UNAUTHORIZED',
          });
          return;
        }
      }

      // validate services
      const service = (authKeyData?.services || []).find(
        (srv) => srv.name.toLowerCase() === scope.toLowerCase()
      );

      if (!service) {
        res.status(403).json({
          authorized: false,
          errorMessage: `The scope "${scope}" is not authorized for this key.`,
          errorCode: 'SERVICE_UNAUTHORIZED',
        });
        return;
      }

      const serviceAction = (authKeyData?.services || []).find((srv) => {
        if (srv.name.toLowerCase() === scope.toLowerCase()) {
          if (srv?.actions.includes(scopeAction)) {
            return true;
          }
        }
        return false;
      });

      if (!serviceAction) {
        res.status(403).json({
          authorized: false,
          errorMessage: `The Scope: "${scope}", Action : "${scopeAction}" is not authorized for this key.`,
          errorCode: 'SERVICE_UNAUTHORIZED',
        });
        return;
      }

      res.locals.apiKey = authKeyData.key;
      next();
    } catch (error: any) {
      // TODO: Add alerting here
      console.error(`Error while validating API key: ${error}`);
      console.error(
        'The API verification server may be down. The client will be permitted to continue.'
      );
      res.status(403).json({
        authorized: false,
        errorMessage: `API verification server may be down.`,
        errorCode: 'INTERNAL_ERROR',
      });
      return;
    }
  };
};

export default apiKeyValidator;
