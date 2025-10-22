import express from 'express';
import * as ai from '../controllers/ai.controller.js';
const r = express.Router();

r.post('/query', ai.chatQuery);
r.get('/insights/:soid', ai.orderInsights);

export default r;
