import { Router } from 'express';
import { researchController } from '../controllers/research.controller.ts';

export const researchRouter = Router();

researchRouter.get('/status', (req, res) => researchController.getStatus(req, res));
researchRouter.get('/runs', (req, res) => researchController.getRuns(req, res));
researchRouter.get('/runs/:id', (req, res) => researchController.getRunById(req, res));
researchRouter.get('/events', (req, res) => researchController.getEvents(req, res));

researchRouter.post('/test', (req, res) => researchController.startTest10(req, res));
researchRouter.post('/test-10', (req, res) => researchController.startTest10(req, res));
researchRouter.post('/start', (req, res) => researchController.startFull(req, res));
researchRouter.post('/full', (req, res) => researchController.startFull(req, res));
researchRouter.post('/pause', (req, res) => researchController.pause(req, res));
researchRouter.post('/resume', (req, res) => researchController.resume(req, res));
researchRouter.post('/stop', (req, res) => researchController.stop(req, res));
researchRouter.post('/retry-failed', (req, res) => researchController.retryFailed(req, res));
researchRouter.post('/failed-only', (req, res) => researchController.startFailedOnly(req, res));
researchRouter.post('/incremental', (req, res) => researchController.startIncremental(req, res));
researchRouter.post('/new-companies', (req, res) => researchController.startNewCompanies(req, res));
researchRouter.post('/verify-all', (req, res) => researchController.verifyAll(req, res));
researchRouter.post('/concurrency', (req, res) => researchController.setConcurrency(req, res));
researchRouter.post('/mode', (req, res) => researchController.setMode(req, res));
researchRouter.post('/location', (req, res) => researchController.setLocation(req, res));
