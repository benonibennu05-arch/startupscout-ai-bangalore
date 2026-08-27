import { Router } from 'express';
import { opportunityController } from '../controllers/opportunity.controller.ts';

export const opportunitiesRouter = Router();

opportunitiesRouter.get('/', (req, res) => opportunityController.getAll(req, res));
opportunitiesRouter.get('/saved', (req, res) => opportunityController.getSaved(req, res));
opportunitiesRouter.post('/verify-all', (req, res) => opportunityController.verifyAll(req, res));
opportunitiesRouter.get('/:id', (req, res) => opportunityController.getById(req, res));
opportunitiesRouter.post('/:id/save', (req, res) => opportunityController.save(req, res));
opportunitiesRouter.delete('/:id/save', (req, res) => opportunityController.unsave(req, res));
opportunitiesRouter.patch('/:id/status', (req, res) => opportunityController.updateStatus(req, res));
opportunitiesRouter.post('/:id/verify', (req, res) => opportunityController.verifySingle(req, res));

