import { Router } from 'express';
import * as ctl from '../controllers/bb1.site.controller.js';

const r = Router();
r.param('id', ctl.loadById);

r.get('/', ctl.list);
r.post('/', ctl.create);
r.get('/:id', ctl.read);
r.put('/:id', ctl.update);
r.delete('/:id', ctl.remove);
r.patch('/:id/archive', ctl.toggleArchive);

export default r;
