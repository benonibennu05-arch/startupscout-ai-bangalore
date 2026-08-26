import { Router } from 'express';
import { opportunityController } from '../controllers/opportunity.controller.ts';

export const opportunitiesRouter = Router();

opportunitiesRouter.get('/', (req, res) => opportunityController.getAll(req, res));
opportunitiesRouter.post('/verify-all', (req, res) => opportunityController.verifyAll(req, res));
opportunitiesRouter.get('/:id', (req, res) => opportunityController.getById(req, res));
opportunitiesRouter.post('/:id/verify', (req, res) => opportunityController.verifySingle(req, res));
