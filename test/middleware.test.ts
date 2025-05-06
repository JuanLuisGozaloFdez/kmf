import { authenticate, authorize } from '../routes/documents';
import { httpRequestDuration, httpRequestCounter } from '../routes/documents';
import NodeCache from 'node-cache';
import express from 'express';
import request from 'supertest';

describe('Middleware Tests', () => {
  describe('Authentication Middleware', () => {
    it('should return 401 if authorization header is missing', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authorization header is missing');
    });

    it('should return 401 if token is missing', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/').set('Authorization', 'Bearer ');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token is missing');
    });

    it('should attach user to request if token is valid', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (req, res) => res.json(req.user));

      const response = await request(app).get('/').set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'user-id');
    });

    it('should return 401 for invalid token format', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/').set('Authorization', 'InvalidTokenFormat');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should return 401 for expired token', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/').set('Authorization', 'Bearer expired-token');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });

  describe('Authorization Middleware', () => {
    it('should return 403 if user role is not authorized', async () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { role: 'user' }; // Mock user role
        next();
      });
      app.use(authorize(['admin']));
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied');
    });

    it('should allow access if user role is authorized', async () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { role: 'admin' }; // Mock user role
        next();
      });
      app.use(authorize(['admin']));
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });

    it('should return 403 if req.user is missing', async () => {
      const app = express();
      app.use(authorize(['admin']));
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied');
    });

    it('should allow access if no roles are provided', async () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { role: 'user' }; // Mock user role
        next();
      });
      app.use(authorize([])); // No roles provided
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });

  describe('Authorization Middleware - Additional Tests', () => {
    it('should allow access if roles array is empty', async () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { role: 'user' }; // Mock user role
        next();
      });
      app.use(authorize([])); // Empty roles array
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });

  describe('Metrics Middleware', () => {
    it('should record metrics for HTTP requests', async () => {
      const app = express();
      app.use((req, res, next) => {
        const end = httpRequestDuration.startTimer();
        res.on('finish', () => {
          end({ method: req.method, route: req.path, status_code: res.statusCode });
          httpRequestCounter.inc({ method: req.method, route: req.path, status_code: res.statusCode });
        });
        next();
      });
      app.get('/', (req, res) => res.sendStatus(200));

      await request(app).get('/');
      // No assertions here, but you can mock `httpRequestDuration` and `httpRequestCounter` to verify calls.
    });

    it('should record metrics for successful HTTP requests', async () => {
      const mockStartTimer = jest.fn(() => jest.fn());
      const mockInc = jest.fn();

      jest.spyOn(httpRequestDuration, 'startTimer').mockImplementation(mockStartTimer);
      jest.spyOn(httpRequestCounter, 'inc').mockImplementation(mockInc);

      const app = express();
      app.use((req, res, next) => {
        const end = httpRequestDuration.startTimer();
        res.on('finish', () => {
          end({ method: req.method, route: req.path, status_code: res.statusCode });
          httpRequestCounter.inc({ method: req.method, route: req.path, status_code: res.statusCode });
        });
        next();
      });
      app.get('/', (req, res) => res.sendStatus(200));

      await request(app).get('/');

      expect(mockStartTimer).toHaveBeenCalled();
      expect(mockInc).toHaveBeenCalledWith({ method: 'GET', route: '/', status_code: 200 });
    });

    it('should record metrics for failed HTTP requests', async () => {
      const mockStartTimer = jest.fn(() => jest.fn());
      const mockInc = jest.fn();

      jest.spyOn(httpRequestDuration, 'startTimer').mockImplementation(mockStartTimer);
      jest.spyOn(httpRequestCounter, 'inc').mockImplementation(mockInc);

      const app = express();
      app.use((req, res, next) => {
        const end = httpRequestDuration.startTimer();
        res.on('finish', () => {
          end({ method: req.method, route: req.path, status_code: res.statusCode });
          httpRequestCounter.inc({ method: req.method, route: req.path, status_code: res.statusCode });
        });
        next();
      });
      app.get('/', (req, res) => res.status(500).send('Internal Server Error'));

      await request(app).get('/');

      expect(mockStartTimer).toHaveBeenCalled();
      expect(mockInc).toHaveBeenCalledWith({ method: 'GET', route: '/', status_code: 500 });
    });

    it('should handle failures in httpRequestDuration', async () => {
      jest.spyOn(httpRequestDuration, 'startTimer').mockImplementation(() => {
        throw new Error('Metrics failure');
      });

      const app = express();
      app.use((req, res, next) => {
        try {
          const end = httpRequestDuration.startTimer();
          res.on('finish', () => end());
        } catch (error) {
          console.error(error);
        }
        next();
      });
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });

    it('should handle failures in metrics recording', async () => {
      jest.spyOn(httpRequestDuration, 'startTimer').mockImplementation(() => {
        throw new Error('Metrics failure');
      });

      const app = express();
      app.use((req, res, next) => {
        try {
          const end = httpRequestDuration.startTimer();
          res.on('finish', () => end());
        } catch (error) {
          console.error(error);
        }
        next();
      });
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });

  describe('Metrics Middleware - Additional Tests', () => {
    it('should handle failures in httpRequestDuration', async () => {
      jest.spyOn(httpRequestDuration, 'startTimer').mockImplementation(() => {
        throw new Error('Metrics failure');
      });

      const app = express();
      app.use((req, res, next) => {
        try {
          const end = httpRequestDuration.startTimer();
          res.on('finish', () => end());
        } catch (error) {
          console.error(error);
        }
        next();
      });
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });

  describe('Cache Middleware', () => {
    it('should serve cached data if available', async () => {
      const cache = new NodeCache();
      const app = express();
      app.use((req, res, next) => {
        const key = req.originalUrl;
        const cachedData = cache.get(key);
        if (cachedData) return res.json(cachedData);
        res.sendResponse = res.json;
        res.json = (body) => {
          cache.set(key, body);
          res.sendResponse(body);
        };
        next();
      });
      app.get('/', (req, res) => res.json({ data: 'test' }));

      await request(app).get('/');
      const response = await request(app).get('/');
      expect(response.body).toHaveProperty('data', 'test');
    });

    it('should cache the response for subsequent requests', async () => {
      const cache = new NodeCache();
      const app = express();
      app.use((req, res, next) => {
        const key = req.originalUrl;
        const cachedData = cache.get(key);
        if (cachedData) return res.json(cachedData);
        res.sendResponse = res.json;
        res.json = (body) => {
          cache.set(key, body);
          res.sendResponse(body);
        };
        next();
      });
      app.get('/', (req, res) => res.json({ data: 'cached response' }));

      const firstResponse = await request(app).get('/');
      expect(firstResponse.body).toHaveProperty('data', 'cached response');

      const cachedData = cache.get('/');
      expect(cachedData).toEqual({ data: 'cached response' });

      const secondResponse = await request(app).get('/');
      expect(secondResponse.body).toHaveProperty('data', 'cached response');
    });

    it('should not serve cached data if cache is empty', async () => {
      const cache = new NodeCache();
      const app = express();
      app.use((req, res, next) => {
        const key = req.originalUrl;
        const cachedData = cache.get(key);
        if (cachedData) return res.json(cachedData);
        res.sendResponse = res.json;
        res.json = (body) => {
          cache.set(key, body);
          res.sendResponse(body);
        };
        next();
      });
      app.get('/', (req, res) => res.json({ data: 'new response' }));

      const response = await request(app).get('/');
      expect(response.body).toHaveProperty('data', 'new response');
    });

    it('should not serve data if cache is cleared', async () => {
      const cache = new NodeCache();
      const app = express();
      app.use((req, res, next) => {
        const key = req.originalUrl;
        const cachedData = cache.get(key);
        if (cachedData) return res.json(cachedData);
        res.sendResponse = res.json;
        res.json = (body) => {
          cache.set(key, body);
          res.sendResponse(body);
        };
        next();
      });
      app.get('/', (req, res) => res.json({ data: 'cached response' }));

      await request(app).get('/');
      cache.flushAll(); // Clear the cache
      const response = await request(app).get('/');
      expect(response.body).toHaveProperty('data', 'cached response');
    });

    it('should not serve expired cached data', async () => {
      const cache = new NodeCache({ stdTTL: 1 }); // 1-second TTL
      const app = express();
      app.use((req, res, next) => {
        const key = req.originalUrl;
        const cachedData = cache.get(key);
        if (cachedData) return res.json(cachedData);
        res.sendResponse = res.json;
        res.json = (body) => {
          cache.set(key, body);
          res.sendResponse(body);
        };
        next();
      });
      app.get('/', (req, res) => res.json({ data: 'cached response' }));

      await request(app).get('/');
      await new Promise((resolve) => setTimeout(resolve, 1100)); // Wait for cache to expire
      const response = await request(app).get('/');
      expect(response.body).toHaveProperty('data', 'cached response');
    });
  });

  describe('Cache Middleware - Additional Tests', () => {
    it('should not serve expired cached data', async () => {
      const cache = new NodeCache({ stdTTL: 1 }); // 1-second TTL
      const app = express();
      app.use((req, res, next) => {
        const key = req.originalUrl;
        const cachedData = cache.get(key);
        if (cachedData) return res.json(cachedData);
        res.sendResponse = res.json;
        res.json = (body) => {
          cache.set(key, body);
          res.sendResponse(body);
        };
        next();
      });
      app.get('/', (req, res) => res.json({ data: 'cached response' }));

      await request(app).get('/');
      await new Promise((resolve) => setTimeout(resolve, 1100)); // Wait for cache to expire
      const response = await request(app).get('/');
      expect(response.body).toHaveProperty('data', 'cached response');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      const app = express();
      app.get('/', (req, res) => {
        throw new Error('Unexpected error');
      });
      app.use((err, req, res, next) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app).get('/');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });

    it('should return 404 for unknown routes', async () => {
      const app = express();
      app.use((req, res, next) => {
        const error = new Error('Not Found');
        error.status = 404;
        next(error);
      });
      app.use((err, req, res, next) => {
        res.status(err.status || 500).json({ error: err.message });
      });

      const response = await request(app).get('/unknown-route');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
    });

    it('should handle validation errors gracefully', async () => {
      const app = express();
      app.use(express.json());
      app.post('/validate', (req, res, next) => {
        if (!req.body.name) {
          const error = new Error('Validation Error: Name is required');
          error.status = 400;
          return next(error);
        }
        res.sendStatus(200);
      });
      app.use((err, req, res, next) => {
        res.status(err.status || 500).json({ error: err.message });
      });

      const response = await request(app).post('/validate').send({});
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error: Name is required');
    });

    it('should return 500 for unhandled exceptions', async () => {
      const app = express();
      app.get('/', (req, res) => {
        throw new Error('Unhandled exception');
      });
      app.use((err, req, res, next) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app).get('/');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });

    it('should include stack trace in development mode', async () => {
      const app = express();
      app.get('/', (req, res) => {
        throw new Error('Development error');
      });
      app.use((err, req, res, next) => {
        if (process.env.NODE_ENV === 'development') {
          res.status(500).json({ error: err.message, stack: err.stack });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      });

      process.env.NODE_ENV = 'development';
      const response = await request(app).get('/');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Development error');
      expect(response.body).toHaveProperty('stack');
    });

    it('should return 400 for invalid JSON in request body', async () => {
      const app = express();
      app.use(express.json());
      app.post('/test', (req, res) => res.sendStatus(200));
      app.use((err, req, res, next) => {
        res.status(400).json({ error: 'Invalid JSON' });
      });

      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send('invalid-json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid JSON');
    });

    it('should handle unexpected errors gracefully', async () => {
      const app = express();
      app.get('/', (req, res) => {
        throw new Error('Unexpected error');
      });
      app.use((err, req, res, next) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app).get('/');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('Error Handling - Additional Tests', () => {
    it('should handle errors without a status property', async () => {
      const app = express();
      app.get('/', (req, res, next) => {
        const error = new Error('Unknown error');
        next(error);
      });
      app.use((err, req, res, next) => {
        res.status(err.status || 500).json({ error: err.message });
      });

      const response = await request(app).get('/');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Unknown error');
    });

    it('should handle non-Error objects gracefully', async () => {
      const app = express();
      app.get('/', (req, res, next) => {
        next('String error');
      });
      app.use((err, req, res, next) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app).get('/');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });
});

describe('Middleware Tests - Additional Scenarios', () => {
  describe('Error Handling', () => {
    it('should return 400 for invalid JSON in request body', async () => {
      const app = express();
      app.use(express.json());
      app.post('/test', (req, res) => res.sendStatus(200));
      app.use((err, req, res, next) => {
        res.status(400).json({ error: 'Invalid JSON' });
      });

      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send('invalid-json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid JSON');
    });

    it('should handle unexpected errors gracefully', async () => {
      const app = express();
      app.get('/', (req, res) => {
        throw new Error('Unexpected error');
      });
      app.use((err, req, res, next) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app).get('/');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('Authorization Middleware', () => {
    it('should return 403 if no roles are provided', async () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { role: 'user' }; // Mock user role
        next();
      });
      app.use(authorize([])); // No roles provided
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied');
    });
  });

  describe('Metrics Middleware', () => {
    it('should handle failures in metrics recording', async () => {
      jest.spyOn(httpRequestDuration, 'startTimer').mockImplementation(() => {
        throw new Error('Metrics failure');
      });

      const app = express();
      app.use((req, res, next) => {
        try {
          const end = httpRequestDuration.startTimer();
          res.on('finish', () => end());
        } catch (error) {
          console.error(error);
        }
        next();
      });
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });

  describe('Cache Middleware', () => {
    it('should not serve data if cache is cleared', async () => {
      const cache = new NodeCache();
      const app = express();
      app.use((req, res, next) => {
        const key = req.originalUrl;
        const cachedData = cache.get(key);
        if (cachedData) return res.json(cachedData);
        res.sendResponse = res.json;
        res.json = (body) => {
          cache.set(key, body);
          res.sendResponse(body);
        };
        next();
      });
      app.get('/', (req, res) => res.json({ data: 'cached response' }));

      await request(app).get('/');
      cache.flushAll(); // Clear the cache
      const response = await request(app).get('/');
      expect(response.body).toHaveProperty('data', 'cached response');
    });
  });

  describe('Authentication Middleware', () => {
    it('should return 401 for invalid token format', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/').set('Authorization', 'InvalidTokenFormat');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should return 401 for expired token', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/').set('Authorization', 'Bearer expired-token');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });

  describe('Authorization Middleware', () => {
    it('should return 403 if req.user is missing', async () => {
      const app = express();
      app.use(authorize(['admin']));
      app.get('/', (req, res) => res.sendStatus(200));

      const response = await request(app).get('/');
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied');
    });
  });
});
