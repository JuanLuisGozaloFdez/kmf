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

// POST /documents - Create a new document
router.post('/documents', upload.fields([
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
    const document: Document = {
      id: documentId,
      type: properties.documentType,
      properties,
      contentFile: contentFile ? contentFile.filename : '',
      associations: {
        locationGLNList: properties.locationGLNList,
        productList: properties.productList,
        organizationList: properties.organizationList,
        epcList: properties.epcList,
        eventIDList: properties.eventIDList,
        transactionIDList: properties.transactionIDList
      },
      entitlement,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-id', // Will be populated from auth context
      organizationId: 'org-id' // Will be populated from auth context
    };

    // TODO: Implement actual storage
    // For demonstration, randomly return 201 or 202
    if (Math.random() > 0.5) {
      res.status(201).json(document);
    } else {
      res.status(202).json({
        correlationId,
        documentId,
        message: 'Document creation in progress'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating document:', error);
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

    // TODO: Implement content retrieval
    res.status(404).json({ error: 'Document content not found' });
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

    // TODO: Implement content update
    res.status(404).json({ error: 'Document not found' });
  } catch (error) {
    console.error('Error updating document content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /documents/{docId}/entitlement - Get document entitlement
router.get('/documents/:docId/entitlement', async (req, res) => {
  try {
    const { docId } = req.params;

    // TODO: Implement entitlement retrieval
    res.status(404).json({ error: 'Document not found' });
  } catch (error) {
    console.error('Error retrieving document entitlement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /documents/{docId}/entitlement - Update document entitlement
router.put('/documents/:docId/entitlement', express.json(), async (req, res) => {
  try {
    const { docId } = req.params;
    const entitlement = documentEntitlementSchema.parse(req.body);

    // TODO: Implement entitlement update
    res.status(404).json({ error: 'Document not found' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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

    // Generate correlation ID for async processing
    const correlationId = crypto.randomUUID();
    const attachmentId = crypto.randomUUID();

    // TODO: Implement attachment creation
    res.status(201).json({
      correlationId,
      attachmentId,
      message: 'Attachment created successfully'
    });
  } catch (error) {
    console.error('Error creating attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /documents/{docId}/attachments/{attachmentId} - Get attachment
router.get('/documents/:docId/attachments/:attachmentId', async (req, res) => {
  try {
    const { docId, attachmentId } = req.params;

    // TODO: Implement attachment retrieval
    res.status(404).json({ error: 'Attachment not found' });
  } catch (error) {
    console.error('Error retrieving attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /documents/{docId}/attachments/{attachmentId} - Update attachment
router.put('/documents/:docId/attachments/:attachmentId', upload.single('content'), async (req, res) => {
  try {
    const { docId, attachmentId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // TODO: Implement attachment update
    res.status(404).json({ error: 'Attachment not found' });
  } catch (error) {
    console.error('Error updating attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /documents/{docId}/attachments/{attachmentId} - Delete attachment
router.delete('/documents/:docId/attachments/:attachmentId', async (req, res) => {
  try {
    const { docId, attachmentId } = req.params;

    // TODO: Implement attachment deletion
    res.status(404).json({ error: 'Attachment not found' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /transactions - Get transaction status
router.get('/transactions', async (req, res) => {
  try {
    const correlationIds = req.query['correlationIds[]'] as string[];
    
    if (!correlationIds || !Array.isArray(correlationIds)) {
      return res.status(400).json({ error: 'correlationIds[] is required' });
    }

    // TODO: Implement transaction status retrieval
    const transactions: Transaction[] = correlationIds.map(id => ({
      correlationId: id,
      status: 'pending'
    }));

    res.json({ transactions });
  } catch (error) {
    console.error('Error retrieving transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;