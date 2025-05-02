import request from 'supertest';
import app from '../../index';
import { jest } from '@jest/globals';
import client from 'prom-client';
import { Promise } from 'bluebird';

jest.mock('prom-client', () => {
  const originalModule = jest.requireActual('prom-client');
  return {
    ...originalModule,
    Registry: jest.fn(() => ({
      metrics: jest.fn().mockResolvedValue(''),
      contentType: 'text/plain',
    })),
    Histogram: jest.fn(() => ({
      startTimer: jest.fn(() => jest.fn()),
    })),
    Counter: jest.fn(() => ({
      inc: jest.fn(),
    })),
  };
});

// Mock database interactions
jest.mock('../../data/dbconfig', () => {
  const originalModule = jest.requireActual('../../data/dbconfig');
  return {
    ...originalModule,
    sequelize: {
      ...originalModule.sequelize,
      sync: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
    },
  };
});

describe('Integration Tests for Documents API', () => {
  it('should create a document and retrieve it', async () => {
    const createResponse = await request(app)
      .post('/documents')
      .send({
        title: 'Test Document',
        content: 'This is a test document.',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toHaveProperty('id');

    const documentId = createResponse.body.id;

    const getResponse = await request(app).get(`/documents/${documentId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty('title', 'Test Document');
  });
});

describe('Integration Tests for Documents API - Edge Cases', () => {
  it('should return 400 if document type is missing in POST /documents', async () => {
    const response = await request(app)
      .post('/documents')
      .send({
        properties: {
          documentTitle: 'Test Document'
        },
        entitlement: {
          mode: 'private'
        }
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 415 if unsupported file type is uploaded in POST /documents', async () => {
    const response = await request(app)
      .post('/documents')
      .field('properties', JSON.stringify({
        documentType: 'Generic Document',
        documentTitle: 'Test Document'
      }))
      .field('entitlement', JSON.stringify({
        mode: 'private'
      }))
      .attach('content', Buffer.from('test content'), 'test.unsupported');

    expect(response.status).toBe(415);
    expect(response.body).toHaveProperty('error', 'Unsupported Media Type');
  });

  it('should return 404 if document does not exist in GET /documents/:docId', async () => {
    const response = await request(app).get('/documents/nonexistent-doc-id');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Document not found');
  });

  it('should return 403 if user is not authorized to access a document', async () => {
    const response = await request(app)
      .get('/documents/authorized-doc-id')
      .set('Authorization', 'Bearer invalid-user-token');

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error', 'Access denied');
  });

  it('should return 500 if database query fails in GET /documents', async () => {
    jest.spyOn(DocumentModel, 'findAll').mockImplementation(() => {
      throw new Error('Database query failed');
    });

    const response = await request(app).get('/documents').query({ 'docIds[]': ['1'] });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error', 'Internal server error');

    jest.restoreAllMocks();
  });

  it('should return 400 if docIds[] parameter is missing in GET /documents', async () => {
    const response = await request(app).get('/documents');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'docIds[] parameter is required and must be an array');
  });

  it('should return 400 if docIds[] exceeds MAX_LIMIT_DOC in GET /documents', async () => {
    const docIds = Array(101).fill('dummy-id'); // Assuming MAX_LIMIT_DOC is 100
    const response = await request(app).get('/documents').query({ 'docIds[]': docIds });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'The maximum number of documents that can be retrieved is 100');
  });

  it('should return 404 if document type is not found in GET /templates/:documentType', async () => {
    const response = await request(app).get('/templates/NonExistentType');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Document type not found');
  });

  it('should return 404 if document does not exist in GET /documents/:docId/content', async () => {
    const response = await request(app).get('/documents/nonexistent-doc-id/content');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Document not found');
  });

  it('should return 400 if no file is uploaded in PUT /documents/:docId/content', async () => {
    const response = await request(app).put('/documents/nonexistent-doc-id/content');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'No file uploaded');
  });
});

describe('Integration Tests for Documents API - Additional Edge Cases', () => {
  it('should return 400 if docIds[] is not an array in GET /documents', async () => {
    const response = await request(app).get('/documents').query({ 'docIds[]': 'not-an-array' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'docIds[] parameter is required and must be an array');
  });

  it('should return 400 if properties field is missing in POST /documents', async () => {
    const response = await request(app)
      .post('/documents')
      .field('entitlement', JSON.stringify({
        mode: 'private'
      }));

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 if entitlement field is invalid in POST /documents', async () => {
    const response = await request(app)
      .post('/documents')
      .field('properties', JSON.stringify({
        documentType: 'Generic Document',
        documentTitle: 'Test Document'
      }))
      .field('entitlement', 'invalid-entitlement');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 404 if attachment does not exist in GET /documents/:docId/attachments/:attachmentId', async () => {
    const response = await request(app).get('/documents/nonexistent-doc-id/attachments/nonexistent-attachment-id');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Attachment not found');
  });

  it('should return 400 if no file is uploaded in POST /documents/:docId/attachments', async () => {
    const response = await request(app).post('/documents/nonexistent-doc-id/attachments').send({ type: 'test-type' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'No file uploaded');
  });
});

describe('Integration Tests for Documents API - Concurrent Requests', () => {
  it('should handle multiple concurrent requests to GET /documents', async () => {
    const docIds = ['doc1', 'doc2', 'doc3'];

    const requests = Promise.map(Array(10).fill(null), async () => {
      return request(app).get('/documents').query({ 'docIds[]': docIds });
    });

    const responses = await Promise.all(requests);

    responses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('documents');
    });
  });

  it('should handle multiple concurrent requests to POST /documents', async () => {
    const requests = Promise.map(Array(10).fill(null), async (_, index) => {
      return request(app)
        .post('/documents')
        .send({
          title: `Test Document ${index}`,
          content: `This is test document ${index}`,
        });
    });

    const responses = await Promise.all(requests);

    responses.forEach((response) => {
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
  });
});

describe('Integration Tests for Documents API - Boundary Values', () => {
  it('should handle exactly MAX_LIMIT_DOC documents in GET /documents', async () => {
    const docIds = Array(100).fill('dummy-id'); // Assuming MAX_LIMIT_DOC is 100
    const response = await request(app).get('/documents').query({ 'docIds[]': docIds });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('documents');
  });

  it('should return 400 if docIds[] exceeds MAX_LIMIT_DOC by 1 in GET /documents', async () => {
    const docIds = Array(101).fill('dummy-id'); // Assuming MAX_LIMIT_DOC is 100
    const response = await request(app).get('/documents').query({ 'docIds[]': docIds });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'The maximum number of documents that can be retrieved is 100');
  });

  it('should handle a single document in GET /documents', async () => {
    const docIds = ['dummy-id'];
    const response = await request(app).get('/documents').query({ 'docIds[]': docIds });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('documents');
  });
});

describe('Integration Tests for Documents API - Invalid Authorization Tokens', () => {
  it('should return 401 if no authorization token is provided', async () => {
    const response = await request(app).get('/documents');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Authorization token is required');
  });

  it('should return 401 if an invalid authorization token is provided', async () => {
    const response = await request(app)
      .get('/documents')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Invalid authorization token');
  });

  it('should return 403 if the token does not have sufficient permissions', async () => {
    const response = await request(app)
      .get('/documents')
      .set('Authorization', 'Bearer insufficient-permissions-token');

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error', 'Access denied');
  });
});

describe('Integration Tests for Documents API - Empty Payloads', () => {
  it('should return 400 if POST /documents is called with an empty payload', async () => {
    const response = await request(app).post('/documents').send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Payload cannot be empty');
  });

  it('should return 400 if PUT /documents/:docId/content is called with an empty payload', async () => {
    const response = await request(app).put('/documents/nonexistent-doc-id/content').send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Payload cannot be empty');
  });

  it('should return 400 if PUT /documents/:docId/entitlement is called with an empty payload', async () => {
    const response = await request(app).put('/documents/nonexistent-doc-id/entitlement').send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Payload cannot be empty');
  });
});