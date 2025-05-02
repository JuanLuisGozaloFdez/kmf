import express from 'express';
import swaggerUi from 'swagger-ui-express';
import documentsRouter from './routes/documents';
import { swaggerDocument } from './swagger';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import xss from 'xss-clean';
import crypto from 'crypto';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Apply security middlewares
app.use(helmet()); // Adds security headers
app.use(xss()); // Sanitizes user input to prevent XSS attacks

// Apply rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Middleware to add correlation ID to requests
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Serve Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Configure base path for the API
app.use('/kmf/api/documents/v1', documentsRouter);

// Global error handler
app.use((err, req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  console.error(`Correlation ID: ${correlationId}`, err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    correlationId,
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/kmf/api/documents/v1`);
  console.log(`API documentation available at http://localhost:${port}/api-docs`);
});

export default app;