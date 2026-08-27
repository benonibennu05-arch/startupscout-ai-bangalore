import { Router } from 'express';
import { contactController } from '../controllers/contact.controller.ts';

export const contactsRouter = Router();

contactsRouter.get('/', (req, res) => contactController.getAll(req, res));
contactsRouter.get('/stats', (req, res) => contactController.getStats(req, res));
contactsRouter.post('/clean', (req, res) => contactController.clean(req, res));
contactsRouter.post('/verify-all', (req, res) => contactController.verifyAll(req, res));
contactsRouter.post('/:id/verify', (req, res) => contactController.verifySingle(req, res));
