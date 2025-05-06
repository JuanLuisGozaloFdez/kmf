import { z } from 'zod';
import { documentPropertiesSchema, documentAssociationsSchema, documentEntitlementSchema, authenticate, authorize } from '../routes/documents';
import express from 'express';
import request from 'supertest';

describe('Validation Logic', () => {
  describe('documentPropertiesSchema', () => {
    it('should validate valid document properties', () => {
      const validProperties = {
        documentType: 'Generic Document',
        documentTitle: 'Test Document',
        issueDate: '2023-01-01',
        tagList: ['tag1', 'tag2'],
      };
      expect(() => documentPropertiesSchema.parse(validProperties)).not.toThrow();
    });

    it('should fail validation for missing required fields', () => {
      const invalidProperties = { documentTitle: 'Test Document' }; // Missing documentType
      expect(() => documentPropertiesSchema.parse(invalidProperties)).toThrow();
    });

    it('should fail validation for invalid field types', () => {
      const invalidProperties = {
        documentType: 'Generic Document',
        documentTitle: 12345, // Invalid type
      };
      expect(() => documentPropertiesSchema.parse(invalidProperties)).toThrow();
    });
  });

  describe('documentAssociationsSchema', () => {
    it('should validate valid document associations', () => {
      const validAssociations = {
        locationGLNList: ['gln1', 'gln2'],
      };
      expect(() => documentAssociationsSchema.parse(validAssociations)).not.toThrow();
    });

    it('should fail validation for multiple traceable elements', () => {
      const invalidAssociations = {
        locationGLNList: ['gln1'],
        productList: ['product1'],
      };
      expect(() => documentAssociationsSchema.parse(invalidAssociations)).toThrow(
        'Document can only be linked to one type of traceable element'
      );
    });
  });

  describe('documentEntitlementSchema', () => {
    it('should validate valid entitlement', () => {
      const validEntitlement = {
        mode: 'private',
        entitledOrgIds: ['org1', 'org2'],
      };
      expect(() => documentEntitlementSchema.parse(validEntitlement)).not.toThrow();
    });

    it('should fail validation for invalid mode', () => {
      const invalidEntitlement = { mode: 'invalid-mode' }; // Invalid mode
      expect(() => documentEntitlementSchema.parse(invalidEntitlement)).toThrow();
    });

    it('should validate entitlement without entitledOrgIds', () => {
      const validEntitlement = { mode: 'linked' };
      expect(() => documentEntitlementSchema.parse(validEntitlement)).not.toThrow();
    });
  });
});

describe('Validation Logic - Additional Tests', () => {
  describe('documentPropertiesSchema', () => {
    it('should validate optional fields correctly', () => {
      const validProperties = {
        documentType: 'Generic Document',
        documentTitle: 'Test Document',
        tagList: ['tag1', 'tag2'],
        customProperties: [{ name: 'custom1', value: 'value1' }],
      };
      expect(() => documentPropertiesSchema.parse(validProperties)).not.toThrow();
    });

    it('should fail validation for invalid optional fields', () => {
      const invalidProperties = {
        documentType: 'Generic Document',
        documentTitle: 'Test Document',
        customProperties: [{ name: 'custom1', value: 123, format: 'invalid-format' }],
      };
      expect(() => documentPropertiesSchema.parse(invalidProperties)).toThrow();
    });

    it('should fail validation for missing optional fields', () => {
      const invalidProperties = {
        documentType: 'Generic Document',
        documentTitle: 'Test Document',
        tagList: null, // Invalid type
      };
      expect(() => documentPropertiesSchema.parse(invalidProperties)).toThrow();
    });

    it('should fail validation for invalid customProperties format', () => {
      const invalidProperties = {
        documentType: 'Generic Document',
        documentTitle: 'Test Document',
        customProperties: [{ name: 'custom1', value: 123, format: 'invalid-format' }],
      };
      expect(() => documentPropertiesSchema.parse(invalidProperties)).toThrow();
    });

    it('should fail validation for invalid issueDate format', () => {
      const invalidProperties = {
        documentType: 'Generic Document',
        documentTitle: 'Test Document',
        issueDate: 'invalid-date',
      };
      expect(() => documentPropertiesSchema.parse(invalidProperties)).toThrow();
    });

    it('should fail validation for invalid expiryDate format', () => {
      const invalidProperties = {
        documentType: 'Generic Document',
        documentTitle: 'Test Document',
        expiryDate: 'invalid-date',
      };
      expect(() => documentPropertiesSchema.parse(invalidProperties)).toThrow();
    });

    it('should fail validation for invalid customProperties types', () => {
      const invalidProperties = {
        documentType: 'Generic Document',
        documentTitle: 'Test Document',
        customProperties: [{ name: 123, value: 'value1' }],
      };
      expect(() => documentPropertiesSchema.parse(invalidProperties)).toThrow();
    });
  });

  describe('documentAssociationsSchema', () => {
    it('should fail validation if no traceable elements are provided', () => {
      const invalidAssociations = {};
      expect(() => documentAssociationsSchema.parse(invalidAssociations)).toThrow(
        'Document can only be linked to one type of traceable element'
      );
    });

    it('should fail validation if multiple traceable elements are provided', () => {
      const invalidAssociations = {
        locationGLNList: ['gln1'],
        productList: ['product1'],
      };
      expect(() => documentAssociationsSchema.parse(invalidAssociations)).toThrow(
        'Document can only be linked to one type of traceable element'
      );
    });

    it('should fail validation for invalid epcList format', () => {
      const invalidAssociations = { epcList: [123] }; // Invalid type
      expect(() => documentAssociationsSchema.parse(invalidAssociations)).toThrow();
    });

    it('should fail validation for invalid eventIDList format', () => {
      const invalidAssociations = { eventIDList: [123] }; // Invalid type
      expect(() => documentAssociationsSchema.parse(invalidAssociations)).toThrow();
    });
  });

  describe('documentEntitlementSchema', () => {
    it('should fail validation for invalid entitlement mode', () => {
      const invalidEntitlement = { mode: 'invalid-mode' };
      expect(() => documentEntitlementSchema.parse(invalidEntitlement)).toThrow();
    });

    it('should fail validation for invalid entitledOrgIds type', () => {
      const invalidEntitlement = { mode: 'private', entitledOrgIds: 'invalid-type' };
      expect(() => documentEntitlementSchema.parse(invalidEntitlement)).toThrow();
    });
  });
});

describe('Middleware Logic', () => {
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
  });
});
