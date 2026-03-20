import { Router } from 'express';
import {
  createMetric,
  createBiometricBatch,
  createBiometricUpload,
  createDeviceBiometric,
  listBiometricConsents,
  grantBiometricConsent,
  revokeBiometricConsent
} from './metrics.controller';
import { authenticate } from '../../middleware/auth.middleware';

const metricsRouter = Router();
const biometricsRouter = Router();

metricsRouter.post('/', authenticate, createMetric);
biometricsRouter.post('/upload', authenticate, createBiometricUpload);
biometricsRouter.post('/batch', authenticate, createBiometricBatch);
biometricsRouter.post('/device', authenticate, createDeviceBiometric);
biometricsRouter.get('/consents', authenticate, listBiometricConsents);
biometricsRouter.post('/consents', authenticate, grantBiometricConsent);
biometricsRouter.post('/consents/:id/revoke', authenticate, revokeBiometricConsent);

export { biometricsRouter };
export default metricsRouter;
