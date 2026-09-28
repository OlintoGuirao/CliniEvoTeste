import './loadEnv.js';

import express from 'express';
import cors from 'cors';
import adminRoutes from './routes/admin.js';
import clinicRoutes from './routes/clinic.js';
import salonRoutes from './routes/salon.js';

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/admin', adminRoutes);
app.use('/clinic', clinicRoutes);
app.use('/salon', salonRoutes);

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
