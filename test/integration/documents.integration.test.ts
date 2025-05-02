import request from 'supertest';
import app from '../../index';

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