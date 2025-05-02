import request from 'supertest';
import app from '../index'; // Assuming your Express app is exported from index.ts
import { sequelize } from '../data/dbConfig';
import { DocumentModel, AttachmentModel } from '../routes/documents';

describe('Documents API', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true }); // Reset database before tests
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /documents', () => {
    it('should create a new document', async () => {
      const response = await request(app)
        .post('/documents')
        .field('properties', JSON.stringify({
          documentType: 'Generic Document',
          documentTitle: 'Test Document'
        }))
        .field('entitlement', JSON.stringify({
          mode: 'private'
        }));

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should log a successful transaction when creating a document', async () => {
      const response = await request(app)
        .post('/documents')
        .field('properties', JSON.stringify({
          documentType: 'Generic Document',
          documentTitle: 'Test Document'
        }))
        .field('entitlement', JSON.stringify({
          mode: 'private'
        }));

      expect(response.status).toBe(201);

      const transaction = await TransactionModel.findOne({
        where: { status: 'completed' }
      });

      expect(transaction).not.toBeNull();
      expect(transaction.status).toBe('completed');
    });

    it('should log a failed transaction when document creation fails', async () => {
      const response = await request(app)
        .post('/documents')
        .field('properties', JSON.stringify({
          documentType: 'Invalid Document Type'
        }))
        .field('entitlement', JSON.stringify({
          mode: 'private'
        }));

      expect(response.status).toBe(400);

      const transaction = await TransactionModel.findOne({
        where: { status: 'failed' }
      });

      expect(transaction).not.toBeNull();
      expect(transaction.status).toBe('failed');
    });

    it('should return 403 if user role is not authorized', async () => {
      const response = await request(app)
        .post('/documents')
        .set('Authorization', 'Bearer valid-user-token') // Simulate a valid user token
        .send({
          properties: JSON.stringify({
            documentType: 'Generic Document',
            documentTitle: 'Test Document'
          }),
          entitlement: JSON.stringify({
            mode: 'private'
          })
        });
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied');
    });

    it('should allow access if user role is authorized', async () => {
      const response = await request(app)
        .post('/documents')
        .set('Authorization', 'Bearer valid-admin-token') // Simulate a valid admin token
        .send({
          properties: JSON.stringify({
            documentType: 'Generic Document',
            documentTitle: 'Test Document'
          }),
          entitlement: JSON.stringify({
            mode: 'private'
          })
        });
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should return 400 if required fields are missing in POST /documents', async () => {
      const response = await request(app)
        .post('/documents')
        .field('entitlement', JSON.stringify({
          mode: 'private'
        }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /documents', () => {
    it('should retrieve a list of documents', async () => {
      const response = await request(app).get('/documents').query({ 'docIds[]': ['1'] });
      expect(response.status).toBe(200);
    });

    it('should return 500 if database query fails in GET /documents', async () => {
      jest.spyOn(DocumentModel, 'findAll').mockImplementation(() => {
        throw new Error('Database query failed');
      });
    
      const response = await request(app).get('/documents').query({ 'docIds[]': ['1'] });
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Database query failed');
    
      jest.restoreAllMocks();
    });

    it('should return 404 if document does not exist in GET /documents/:docId/entitlement', async () => {
      const response = await request(app)
        .get('/documents/nonexistent-doc-id/entitlement');
    
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Document not found');
    });

    it('should return 400 if invalid data is provided in PUT /documents/:docId/entitlement', async () => {
      const response = await request(app)
        .put(`/documents/${documentId}/entitlement`)
        .send({ mode: 'invalid-mode' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Attachments API', () => {
    let documentId: string;
    let attachmentId: string;

    beforeAll(async () => {
      // Create a document to attach files to
      const document = await DocumentModel.create({
        type: 'Generic Document',
        properties: { documentTitle: 'Test Document' },
        createdBy: 'test-user',
        organizationId: 'test-org'
      });
      documentId = document.id;
    });

    it('should create an attachment for a document', async () => {
      const response = await request(app)
        .post(`/documents/${documentId}/attachments`)
        .field('type', 'image/png')
        .attach('content', Buffer.from('test content'), 'test.png');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('attachmentId');
      attachmentId = response.body.attachmentId;
    });

    it('should retrieve an attachment for a document', async () => {
      const response = await request(app)
        .get(`/documents/${documentId}/attachments/${attachmentId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', attachmentId);
    });

    it('should update an attachment for a document', async () => {
      const response = await request(app)
        .put(`/documents/${documentId}/attachments/${attachmentId}`)
        .attach('content', Buffer.from('updated content'), 'updated.png');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Attachment updated successfully');
    });

    it('should delete an attachment for a document', async () => {
      const response = await request(app)
        .delete(`/documents/${documentId}/attachments/${attachmentId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Attachment deleted successfully');
    });

    it('should return 415 if unsupported file type is uploaded', async () => {
      const response = await request(app)
        .post(`/documents/${documentId}/attachments`)
        .field('type', 'application/unsupported')
        .attach('content', Buffer.from('test content'), 'test.unsupported');

      expect(response.status).toBe(415);
      expect(response.body).toHaveProperty('error', 'Unsupported Media Type');
    });

    it('should return 404 if attachment does not exist', async () => {
      const response = await request(app)
        .get(`/documents/${documentId}/attachments/nonexistent-attachment-id`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Attachment not found');
    });
  });

  describe('Transaction Status API', () => {
    it('should retrieve transaction statuses', async () => {
      const correlationIds = ['12345', '67890'];
      const response = await request(app)
        .get('/transactions')
        .query({ 'correlationIds[]': correlationIds });
      expect(response.status).toBe(200);
      expect(response.body.transactions).toHaveLength(correlationIds.length);
      expect(response.body.transactions[0]).toHaveProperty('correlationId', '12345');
      expect(response.body.transactions[0]).toHaveProperty('status', 'completed');
    });

    it('should return 401 if no authorization header is provided', async () => {
      const response = await request(app).get('/categories');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authorization header is missing');
    });

    it('should return 401 if token is missing', async () => {
      const response = await request(app)
        .get('/categories')
        .set('Authorization', 'Bearer ');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token is missing');
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .get('/categories')
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should return 500 if database query fails in GET /transactions', async () => {
      jest.spyOn(TransactionModel, 'findAll').mockImplementation(() => {
        throw new Error('Database query failed');
      });

      const response = await request(app).get('/transactions').query({ 'correlationIds[]': ['12345'] });
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Database query failed');

      jest.restoreAllMocks();
    });
  });
});