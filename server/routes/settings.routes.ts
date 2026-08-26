import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller.ts';

export const settingsRouter = Router();

settingsRouter.get('/', (req, res) => settingsController.getSettings(req, res));
settingsRouter.put('/', (req, res) => settingsController.updateSettings(req, res));
