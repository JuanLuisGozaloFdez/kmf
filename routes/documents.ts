import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { documentTemplates } from '../data/templates';
import { 
  Document, 
  DocumentProperties, 
  DocumentAssociations, 
  DocumentEntitlement, 
  SearchConditions,
  Transaction
} from '../types';
import { sequelize } from '../data/dbConfig';
import { DataTypes } from 'sequelize';
import client from 'prom-client';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
dotenv.config();

const MAX_LIMIT_DOC = parseInt(process.env.MAX_LIMIT_DOC || '100', 10);

// Create a Registry to register metrics
const register = new client.Registry();

// Define metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestCounter);

// Expose metrics endpoint
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const DocumentModel = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  properties: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  contentFile: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  associations: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  entitlement: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  organizationId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
});

const AttachmentModel = sequelize.define('Attachment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contentFile: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
});

const TransactionModel = sequelize.define('Transaction', {
  correlationId: {
    type: DataTypes.UUID,
    primaryKey: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
});

(async () => {
  await DocumentModel.sync();
  await AttachmentModel.sync();
  await TransactionModel.sync();
})();

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    fieldSize: 20 * 1024 // 20KB limit for JSON fields
  }
});

// Validation schemas
const customPropertySchema = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number()]),
  format: z.enum(['date', 'date-time', 'gln', 'gtin', 'uri']).optional()
});

const documentPropertiesSchema = z.object({
  documentType: z.string(),
  documentTitle: z.string(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  tagList: z.array(z.string()).optional(),
  customProperties: z.array(customPropertySchema).optional(),
  locationGLNList: z.array(z.string()).optional(),
  productList: z.array(z.string()).optional(),
  organizationList: z.array(z.string()).optional(),
  epcList: z.array(z.string()).optional(),
  eventIDList: z.array(z.string()).optional(),
  transactionIDList: z.array(z.string()).optional()
});

const documentAssociationsSchema = z.object({
  locationGLNList: z.array(z.string()).optional(),
  productList: z.array(z.string()).optional(),
  organizationList: z.array(z.string()).optional(),
  epcList: z.array(z.string()).optional(),
  eventIDList: z.array(z.string()).optional(),
  transactionIDList: z.array(z.string()).optional(),
}).refine(data => {
  const traceableElements = [
    data.locationGLNList,
    data.productList,
    data.organizationList,
    data.epcList
  ].filter(list => list && list.length > 0);
  return traceableElements.length <= 1;
}, {
  message: "Document can only be linked to one type of traceable element"
});

const documentEntitlementSchema = z.object({
  mode: z.enum(['private', 'linked']),
  entitledOrgIds: z.array(z.string()).optional()
});

const searchConditionsSchema = z.object({
  orgId: z.array(z.string()).optional(),
  orgIdNot: z.array(z.string()).optional(),
  timestamp: z.union([
    z.string(),
    z.object({
      from: z.string().optional(),
      to: z.string().optional()
    })
  ]).optional(),
  categories: z.array(z.string()).optional(),
  properties: documentPropertiesSchema.partial().optional()
});

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header is missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token is missing' });
    }

    // Simulate token verification (replace with actual verification logic)
    const user = { id: 'user-id', organizationId: 'org-id', role: 'user' }; // Example user object

    req.user = user; // Attach user to request object
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (roles) => (req, res, next) => {
  try {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(403).json({ error: 'Access denied' });
  }
};

router.use(authenticate);

// GET /categories - List all available document types
router.get('/categories', (req, res) => {
  const categories = Object.keys(documentTemplates);
  res.json({ categories });
});

// GET /templates/{documentType} - Get template for specific document type
router.get('/templates/:documentType', (req, res) => {
  const { documentType } = req.params;
  const template = documentTemplates[documentType];

  if (!template) {
    return res.status(404).json({ error: 'Document type not found' });
  }

  res.json(template);
});

// GET /documents - Retrieve a list of documents
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Cache with 5-minute TTL

// Middleware to check cache before querying the database
const cacheMiddleware = (req, res, next) => {
  const key = req.originalUrl;
  const cachedData = cache.get(key);

  if (cachedData) {
    return res.json(cachedData);
  }

  res.sendResponse = res.json;
  res.json = (body) => {
    cache.set(key, body);
    res.sendResponse(body);
  };

  next();
};

router.get('/documents', cacheMiddleware, async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const docIds = req.query['docIds[]'] as string[];
    
    if (!docIds || !Array.isArray(docIds)) {
      httpRequestCounter.inc({ method: 'GET', route: '/documents', status_code: 400 });
      return res.status(400).json({ 
        error: 'docIds[] parameter is required and must be an array' 
      });
    }

    if (docIds.length > MAX_LIMIT_DOC) {
      return res.status(400).json({
        error: `The maximum number of documents that can be retrieved is ${MAX_LIMIT_DOC}`
      });
    }

    const documents = await DocumentModel.findAll({
      where: {
        id: docIds
      },
      attributes: ['id', 'type', 'properties', 'createdAt', 'updatedAt'], // Select only necessary fields
    });

    if (documents.length === 0) {
      httpRequestCounter.inc({ method: 'GET', route: '/documents', status_code: 404 });
      return res.status(404).json({ error: 'No documents found' });
    }

    httpRequestCounter.inc({ method: 'GET', route: '/documents', status_code: 200 });
    res.json({ documents });
  } catch (error) {
    httpRequestCounter.inc({ method: 'GET', route: '/documents', status_code: 500 });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    end({ method: 'GET', route: '/documents', status_code: res.statusCode });
  }
});

// POST /documents - Create a new document
router.post('/documents', authorize(['admin', 'user']), upload.fields([
  { name: 'content', maxCount: 1 },
  { name: 'properties' },
  { name: 'entitlement' }
]), async (req, res) => {
  try {
    // Parse and validate properties
    const propertiesJson = JSON.parse(req.body.properties);
    const properties = documentPropertiesSchema.parse(propertiesJson);

    // Validate document type
    const template = documentTemplates[properties.documentType];
    if (!template) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Validate required properties
    const missingProperties = template.requiredProperties.filter(
      prop => !(prop in properties)
    );
    if (missingProperties.length > 0) {
      return res.status(400).json({
        error: 'Missing required properties',
        missingProperties
      });
    }

    // Parse and validate entitlement if provided
    let entitlement: DocumentEntitlement = { mode: 'private' };
    if (req.body.entitlement) {
      const entitlementJson = JSON.parse(req.body.entitlement);
      entitlement = documentEntitlementSchema.parse(entitlementJson);
    }

    // Handle file upload
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const contentFile = files['content']?.[0];

    if (contentFile) {
      // Validate file type
      if (!template.allowedFileTypes.includes(contentFile.mimetype)) {
        return res.status(415).json({
          error: 'Unsupported Media Type',
          allowedTypes: template.allowedFileTypes
        });
      }
    }

    // Generate correlation ID for async processing
    const correlationId = crypto.randomUUID();
    const documentId = crypto.randomUUID();

    // Create document
    const document = await DocumentModel.create({
      type: properties.documentType,
      properties,
      contentFile,
      associations: {
        locationGLNList: properties.locationGLNList,
        productList: properties.productList,
        organizationList: properties.organizationList,
        epcList: properties.epcList,
        eventIDList: properties.eventIDList,
        transactionIDList: properties.transactionIDList
      },
      entitlement,
      createdBy: 'user-id',
      organizationId: 'org-id',
    });

    // Log transaction
    await TransactionModel.create({
      correlationId: crypto.randomUUID(),
      status: 'completed',
      timestamp: new Date()
    });

    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating document:', error);

    // Log failed transaction
    await TransactionModel.create({
      correlationId: crypto.randomUUID(),
      status: 'failed',
      timestamp: new Date()
    });

    res.status(500).json({ 
      error: 'The transaction to store the document failed and the document is invalid, unrecoverable state. Upload the document again to resolve the problem. If the problem persists, please contact support team.'
    });
  }
});

// GET /documents/{docId}/content - Get document content
router.get('/documents/:docId/content', async (req, res) => {
  try {
    const { docId } = req.params;
    const version = req.query.version ? parseInt(req.query.version as string) : undefined;

    const document = await DocumentModel.findByPk(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ contentFile: document.contentFile });
  } catch (error) {
    console.error('Error retrieving document content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /documents/{docId}/content - Update document content
router.put('/documents/:docId/content', upload.single('content'), async (req, res) => {
  try {
    const { docId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await DocumentModel.findByPk(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    document.contentFile = file.filename;
    await document.save();

    res.json({ message: 'Document content updated successfully' });
  } catch (error) {
    console.error('Error updating document content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /documents/{docId}/entitlement - Get document entitlement
router.get('/documents/:docId/entitlement', async (req, res) => {
  try {
    const { docId } = req.params;

    const document = await DocumentModel.findByPk(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ entitlement: document.entitlement });
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError') {
      console.error('Database query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    console.error('Error retrieving document entitlement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /documents/{docId}/entitlement - Update document entitlement
router.put('/documents/:docId/entitlement', authorize(['admin']), express.json(), async (req, res) => {
  const correlationId = crypto.randomUUID();
  try {
    const { docId } = req.params;
    const entitlement = documentEntitlementSchema.parse(req.body);

    const document = await DocumentModel.findByPk(docId);

    if (!document) {
      await TransactionModel.create({
        correlationId,
        status: 'failed',
        timestamp: new Date()
      });
      return res.status(404).json({ error: 'Document not found' });
    }

    document.entitlement = entitlement;
    await document.save();

    await TransactionModel.create({
      correlationId,
      status: 'completed',
      timestamp: new Date()
    });

    res.json({ message: 'Document entitlement updated successfully' });
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError') {
      console.error('Database query error:', error);
      await TransactionModel.create({
        correlationId,
        status: 'failed',
        timestamp: new Date()
      });
      return res.status(500).json({ error: 'Database query failed' });
    }
    console.error('Error updating document entitlement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /documents/{docId}/attachments - Create attachment
router.post('/documents/:docId/attachments', upload.single('content'), async (req, res) => {
  try {
    const { docId } = req.params;
    const file = req.file;
    const type = req.body.type;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await DocumentModel.findByPk(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const attachment = await AttachmentModel.create({
      documentId: docId,
      type,
      contentFile: file.filename,
    });

    res.status(201).json({
      attachmentId: attachment.id,
      message: 'Attachment created successfully'
    });
  } catch (error) {
    console.error('Error creating attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /documents/{docId}/attachments/:attachmentId - Get attachment
router.get('/documents/:docId/attachments/:attachmentId', async (req, res) => {
  try {
    const { docId, attachmentId } = req.params;

    const document = await DocumentModel.findByPk(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const attachment = await AttachmentModel.findOne({
      where: {
        id: attachmentId,
        documentId: docId,
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    res.json(attachment);
  } catch (error) {
    console.error('Error retrieving attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /documents/{docId}/attachments/:attachmentId - Update attachment
router.put('/documents/:docId/attachments/:attachmentId', upload.single('content'), async (req, res) => {
  try {
    const { docId, attachmentId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await DocumentModel.findByPk(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Simulate attachment update
    res.json({
      attachmentId,
      message: 'Attachment updated successfully'
    });
  } catch (error) {
    console.error('Error updating attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /documents/{docId}/attachments/:attachmentId - Delete attachment
router.delete('/documents/:docId/attachments/:attachmentId', async (req, res) => {
  const correlationId = crypto.randomUUID();
  try {
    const { docId, attachmentId } = req.params;

    const document = await DocumentModel.findByPk(docId);

    if (!document) {
      // Log failed transaction
      await TransactionModel.create({
        correlationId,
        status: 'failed',
        timestamp: new Date()
      });
      return res.status(404).json({ error: 'Document not found' });
    }

    const attachment = await AttachmentModel.findOne({
      where: {
        id: attachmentId,
        documentId: docId,
      },
    });

    if (!attachment) {
      // Log failed transaction
      await TransactionModel.create({
        correlationId,
        status: 'failed',
        timestamp: new Date()
      });
      return res.status(404).json({ error: 'Attachment not found' });
    }

    await attachment.destroy();

    // Log successful transaction
    await TransactionModel.create({
      correlationId,
      status: 'completed',
      timestamp: new Date()
    });

    res.json({
      attachmentId,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    // Log failed transaction
    await TransactionModel.create({
      correlationId,
      status: 'failed',
      timestamp: new Date()
    });

    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /transactions - Get transaction status
router.get('/transactions', async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const correlationIds = req.query['correlationIds[]'] as string[];

    if (!correlationIds || !Array.isArray(correlationIds)) {
      httpRequestCounter.inc({ method: 'GET', route: '/transactions', status_code: 400 });
      return res.status(400).json({ error: 'correlationIds[] is required and must be an array' });
    }

    const transactions = await TransactionModel.findAll({
      where: {
        correlationId: correlationIds
      }
    });

    if (transactions.length === 0) {
      httpRequestCounter.inc({ method: 'GET', route: '/transactions', status_code: 404 });
      return res.status(404).json({ error: 'No transactions found' });
    }

    httpRequestCounter.inc({ method: 'GET', route: '/transactions', status_code: 200 });
    res.json({ transactions });
  } catch (error) {
    httpRequestCounter.inc({ method: 'GET', route: '/transactions', status_code: 500 });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    end({ method: 'GET', route: '/transactions', status_code: res.statusCode });
  }
});


export default router;