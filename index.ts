import express from 'express';
import documentsRouter from './routes/documents';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Configure base path for the API
app.use('/kmf/api/documents/v1', documentsRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/kmf/api/documents/v1`);
});