import express from 'express';
import swaggerUi from 'swagger-ui-express';
import documentsRouter from './routes/documents';
import { swaggerDocument } from './swagger';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Serve Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Configure base path for the API
app.use('/kmf/api/documents/v1', documentsRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/kmf/api/documents/v1`);
  console.log(`API documentation available at http://localhost:${port}/api-docs`);
});