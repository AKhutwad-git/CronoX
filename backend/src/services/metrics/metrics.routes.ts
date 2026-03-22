import { Router } from 'express';
import {
  createMetric,
  createBiometricBatch,
  createBiometricUpload,
  createDeviceBiometric,
  listBiometricConsents,
  grantBiometricConsent,
  revokeBiometricConsent,
  getFocusScoreEndpoint,
  triggerFocusScoreComputation,
  getMetrics
} from './metrics.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';

const metricsRouter = Router();
const biometricsRouter = Router();

metricsRouter.post('/', authenticate, createMetric);
metricsRouter.get('/', authenticate, getMetrics);
metricsRouter.get('/focus-score', authenticate, getFocusScoreEndpoint);
metricsRouter.post('/focus-score/compute', authenticate, authorize(['bio_engine', 'admin', 'professional']), triggerFocusScoreComputation);

biometricsRouter.post('/upload', authenticate, createBiometricUpload);
biometricsRouter.post('/batch', authenticate, createBiometricBatch);
biometricsRouter.post('/device', authenticate, createDeviceBiometric);
biometricsRouter.get('/consents', authenticate, listBiometricConsents);
biometricsRouter.post('/consents', authenticate, grantBiometricConsent);
biometricsRouter.post('/consents/:id/revoke', authenticate, revokeBiometricConsent);

export { biometricsRouter };
export default metricsRouter;

