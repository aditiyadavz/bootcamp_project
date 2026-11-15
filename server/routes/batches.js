// Anyone can list batches, so students can choose theirs when registering.
import { Router } from 'express';
import Batch from '../models/Batch.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await Batch.find().select('name deadline').sort('name').lean());
});

export default router;
