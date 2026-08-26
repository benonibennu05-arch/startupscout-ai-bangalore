import { Router } from 'express';
import { contactController } from '../controllers/contact.controller.ts';

export const contactsRouter = Router();

contactsRouter.get('/', (req, res) => contactController.getAll(req, res));
