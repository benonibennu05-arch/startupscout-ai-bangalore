import { Router } from 'express';
import { companyController } from '../controllers/company.controller.ts';

export const companiesRouter = Router();

companiesRouter.get('/', (req, res) => companyController.getAll(req, res));
companiesRouter.post('/discover', (req, res) => companyController.discover(req, res));
companiesRouter.get('/:id', (req, res) => companyController.getById(req, res));
companiesRouter.post('/:id/research', (req, res) => companyController.researchSingle(req, res));
