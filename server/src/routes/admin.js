import { Router } from 'express';
import { requireAdmin } from '../middlewares/authAdmin.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

/** Todas as rotas /admin exigem email admin@clinievo.com.br */
router.use(requireAdmin);

router.get('/procedure-permissions', adminController.getProcedurePermissions);
router.post('/procedure-permissions', adminController.postProcedurePermission);
router.post('/users', adminController.createUser);
router.post('/set-password', adminController.setPassword);

export default router;
