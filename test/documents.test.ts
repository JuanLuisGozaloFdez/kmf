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

  describe('DELETE /documents/:docId', () => {
    it('should delete a document successfully', async () => {
      const document = await DocumentModel.create({
        type: 'Generic Document',
        properties: { title: 'Test Document' },
        createdBy: 'test-user',
        organizationId: 'test-org',
      });

      const response = await request(app).delete(`/documents/${document.id}`).set('Authorization', 'Bearer valid-admin-token');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Document deleted successfully');
    });

    it('should return 404 if the document does not exist', async () => {
      const response = await request(app).delete('/documents/nonexistent-doc-id').set('Authorization', 'Bearer valid-admin-token');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Document not found');
    });
  });

  describe('POST /documents/search', () => {
    it('should return documents matching the search criteria', async () => {
      await DocumentModel.create({
        type: 'Generic Document',
        properties: { title: 'Searchable Document' },
        createdBy: 'test-user',
        organizationId: 'test-org',
      });

      const response = await request(app)
        .post('/documents/search')
        .send({ properties: { title: 'Searchable Document' } });

      expect(response.status).toBe(200);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0]).toHaveProperty('properties.title', 'Searchable Document');
    });

    it('should return 404 if no documents match the search criteria', async () => {
      const response = await request(app)
        .post('/documents/search')
        .send({ properties: { title: 'Nonexistent Document' } });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'No documents found matching the search criteria');
    });

    it('should return 400 for invalid search criteria', async () => {
      const response = await request(app)
        .post('/documents/search')
        .send({ invalidField: 'value' });

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

  describe('Boundary Values and Invalid Data Types', () => {
    it('should return 400 if document title exceeds maximum length', async () => {
      const longTitle = 'A'.repeat(256); // Assuming max length is 255
      const response = await request(app)
        .post('/documents')
        .field('properties', JSON.stringify({
          documentType: 'Generic Document',
          documentTitle: longTitle
        }))
        .field('entitlement', JSON.stringify({
          mode: 'private'
        }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Document title exceeds maximum length');
    });

    it('should return 400 if document type is not a string', async () => {
      const response = await request(app)
        .post('/documents')
        .field('properties', JSON.stringify({
          documentType: 12345, // Invalid type
          documentTitle: 'Test Document'
        }))
        .field('entitlement', JSON.stringify({
          mode: 'private'
        }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid document type');
    });

    it('should return 400 if entitlement mode is not valid', async () => {
      const response = await request(app)
        .post('/documents')
        .field('properties', JSON.stringify({
          documentType: 'Generic Document',
          documentTitle: 'Test Document'
        }))
        .field('entitlement', JSON.stringify({
          mode: 'invalid-mode' // Invalid mode
        }));

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid entitlement mode');
    });

    it('should return 400 if document ID is not a valid UUID', async () => {
      const invalidDocId = '12345'; // Not a valid UUID
      const response = await request(app).get(`/documents/${invalidDocId}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid document ID');
    });

    it('should return 400 if attachment type is not a string', async () => {
      const response = await request(app)
        .post('/documents/invalid-doc-id/attachments')
        .field('type', 12345) // Invalid type
        .attach('content', Buffer.from('test content'), 'test.png');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid attachment type');
    });
  });

  describe('Boundary Values and Invalid Data Types - Additional Tests', () => {
    it('should return 400 if document type is empty', async () => {
      const response = await request(app)
        .post('/documents')
        .field('properties', JSON.stringify({ documentType: '', documentTitle: 'Test Document' }))
        .field('entitlement', JSON.stringify({ mode: 'private' }));
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid document type');
    });

    it('should return 400 if entitlement mode is empty', async () => {
      const response = await request(app)
        .post('/documents')
        .field('properties', JSON.stringify({ documentType: 'Generic Document', documentTitle: 'Test Document' }))
        .field('entitlement', JSON.stringify({ mode: '' }));
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid entitlement mode');
    });
  });

  describe('Concurrent Requests, Empty Payloads, and Rate Limiting', () => {
    it('should handle concurrent requests gracefully', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/documents')
          .field('properties', JSON.stringify({
            documentType: 'Generic Document',
            documentTitle: `Test Document ${i}`
          }))
          .field('entitlement', JSON.stringify({
            mode: 'private'
          }))
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });
    });

    it('should return 400 if payload is empty', async () => {
      const response = await request(app)
        .post('/documents')
        .send({}); // Empty payload

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Payload cannot be empty');
    });

    it('should return 429 if rate limit is exceeded', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .post('/documents')
          .field('properties', JSON.stringify({
            documentType: 'Generic Document',
            documentTitle: 'Rate Limit Test'
          }))
          .field('entitlement', JSON.stringify({
            mode: 'private'
          }))
      );

      const responses = await Promise.all(requests);

      const rateLimitedResponses = responses.filter((response) => response.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      To add a coverage tool like `nyc` to your project and track test coverage, follow these steps:

      1. **Install `nyc`**:
        Run the following command to install `nyc` as a development dependency:
        ```bash
        npm install --save-dev nyc
        ```

      2. **Update `package.json`**:
        Add a `nyc` configuration and update the `test` script to include `nyc`. Your `package.json` should look like this:
        ```json
        {
          "scripts": {
           "test": "nyc --reporter=text --reporter=html jest"
          },
          "nyc": {
           "include": ["routes/**/*.ts", "test/**/*.ts"],
           "exclude": ["node_modules", "dist"],
           "extension": [".ts"],
           "reporter": ["text", "html"],
           "all": true,
           "check-coverage": true,
           "statements": 80,
           "branches": 80,
           "functions": 80,
           "lines": 80
          }
        }
        ```

      3. **Run Tests with Coverage**:
        Execute the following command to run your tests and generate a coverage report:
        ```bash
        npm test
        ```

      4. **View Coverage Report**:
        After running the tests, `nyc` will generate a coverage report in the terminal and an HTML report in the `coverage` directory. Open `coverage/index.html` in your browser to view the detailed report.

      5. **Ensure Coverage Thresholds**:
        The `check-coverage` option in the `nyc` configuration ensures that your tests meet the specified coverage thresholds (80% in this example). If the thresholds are not met, the test run will fail.

      This setup will help you track and enforce test coverage in your project.
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('trace');
      });

      it('should return 400 for invalid depth parameter', async () => {
        const response = await request(app)
          .post('/epcs/valid-epc-id/trace')
          .send({ depth: -1 });
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Depth must be a non-negative integer');
      });
    });

    describe('GET /epcs/:epc_id/trace/consumer', () => {
      it('should return consumer trace results for a valid EPC', async () => {
        const response = await request(app).get('/epcs/valid-epc-id/trace/consumer');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('trace');
      });
    });

    describe('POST /epcs/:epc_id/trace/consumer', () => {
      it('should return consumer trace results for a valid EPC', async () => {
        const response = await request(app)
          .post('/epcs/valid-epc-id/trace/consumer')
          .send({ include_events: true });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('trace');
      });
    });
  });
});