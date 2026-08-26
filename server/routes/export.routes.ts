import { Router } from 'express';
import { exportController } from '../controllers/export.controller.ts';

export const exportRouter = Router();

exportRouter.get('/csv', (req, res) => exportController.exportCsv(req, res));
exportRouter.get('/xlsx', (req, res) => exportController.exportXlsx(req, res));
