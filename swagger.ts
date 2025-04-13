import { OpenAPIV3 } from 'openapi-types';

export const swaggerDocument: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Documents API',
    version: '1.0.0',
    description: 'API for managing supply chain documents and certificates'
  },
  servers: [
    {
      url: '/kmf/api/documents/v1',
      description: 'Documents API base URL'
    }
  ],
  components: {
    schemas: {
      DocumentProperties: {
        type: 'object',
        required: ['documentType', 'documentTitle'],
        properties: {
          documentType: {
            type: 'string',
            enum: ['Generic Document', 'Generic Certificate', 'GAA BAP Certificate']
          },
          documentTitle: { type: 'string' },
          issueDate: { type: 'string', format: 'date' },
          expiryDate: { type: 'string', format: 'date' },
          tagList: {
            type: 'array',
            items: { type: 'string' }
          },
          customProperties: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'value'],
              properties: {
                name: { type: 'string' },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' }
                  ]
                },
                format: {
                  type: 'string',
                  enum: ['date', 'date-time', 'gln', 'gtin', 'uri']
                }
              }
            }
          },
          locationGLNList: {
            type: 'array',
            items: { type: 'string' }
          },
          productList: {
            type: 'array',
            items: { type: 'string' }
          },
          organizationList: {
            type: 'array',
            items: { type: 'string' }
          },
          epcList: {
            type: 'array',
            items: { type: 'string' }
          },
          eventIDList: {
            type: 'array',
            items: { type: 'string' }
          },
          transactionIDList: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      EntitlementInfo: {
        type: 'object',
        required: ['mode'],
        properties: {
          mode: {
            type: 'string',
            enum: ['private', 'linked']
          },
          entitledOrgIds: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      Document: {
        type: 'object',
        required: ['id', 'type', 'properties', 'contentFile', 'associations', 'entitlement', 'createdAt', 'updatedAt', 'createdBy', 'organizationId'],
        properties: {
          id: { type: 'string' },
          type: { 
            type: 'string',
            enum: ['Generic Document', 'Generic Certificate', 'GAA BAP Certificate']
          },
          properties: { $ref: '#/components/schemas/DocumentProperties' },
          contentFile: { type: 'string' },
          attachments: {
            type: 'array',
            items: { type: 'string' }
          },
          associations: {
            type: 'object',
            properties: {
              locationGLNList: {
                type: 'array',
                items: { type: 'string' }
              },
              productList: {
                type: 'array',
                items: { type: 'string' }
              },
              organizationList: {
                type: 'array',
                items: { type: 'string' }
              },
              epcList: {
                type: 'array',
                items: { type: 'string' }
              },
              eventIDList: {
                type: 'array',
                items: { type: 'string' }
              },
              transactionIDList: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          entitlement: { $ref: '#/components/schemas/EntitlementInfo' },
          version: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          createdBy: { type: 'string' },
          organizationId: { type: 'string' }
        }
      },
      Documents: {
        type: 'object',
        required: ['documents'],
        properties: {
          documents: {
            type: 'array',
            items: { $ref: '#/components/schemas/Document' }
          }
        }
      },
      SearchConditions: {
        type: 'object',
        properties: {
          orgId: {
            type: 'array',
            items: { type: 'string' }
          },
          orgIdNot: {
            type: 'array',
            items: { type: 'string' }
          },
          timestamp: {
            oneOf: [
              { type: 'string', format: 'date-time' },
              {
                type: 'object',
                properties: {
                  from: { type: 'string', format: 'date-time' },
                  to: { type: 'string', format: 'date-time' }
                }
              }
            ]
          },
          categories: {
            type: 'array',
            items: { type: 'string' }
          },
          properties: { $ref: '#/components/schemas/DocumentProperties' }
        }
      },
      SearchResults: {
        type: 'object',
        required: ['total', 'offset', 'limit', 'documents'],
        properties: {
          total: { type: 'integer' },
          offset: { type: 'integer' },
          limit: { type: 'integer' },
          documents: {
            type: 'array',
            items: { $ref: '#/components/schemas/Document' }
          }
        }
      },
      Transaction: {
        type: 'object',
        required: ['correlationId', 'status'],
        properties: {
          correlationId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed']
          },
          documentId: { type: 'string' },
          error: { type: 'string' }
        }
      },
      Transactions: {
        type: 'object',
        required: ['transactions'],
        properties: {
          transactions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Transaction' }
          }
        }
      }
    },
    responses: {
      BadRequest: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      NotFound: {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      Gone: {
        description: 'Gone',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      PayloadTooLarge: {
        description: 'Payload Too Large',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      UnsupportedMediaType: {
        description: 'Unsupported Media Type',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  paths: {
    '/documents': {
      get: {
        tags: ['Documents'],
        summary: 'Retrieves a list of documents',
        description: 'Retrieves information about the specified documents, including properties and references to any attachments.',
        parameters: [
          {
            name: 'docIds[]',
            in: 'query',
            required: true,
            schema: {
              type: 'array',
              items: { type: 'string' }
            },
            description: 'Array of document IDs to retrieve'
          }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Documents' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      },
      post: {
        tags: ['Documents'],
        summary: 'Creates a new document',
        description: 'Creates a new document with properties, content, and entitlement information.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['properties'],
                properties: {
                  properties: { $ref: '#/components/schemas/DocumentProperties' },
                  content: {
                    type: 'string',
                    format: 'binary'
                  },
                  entitlement: { $ref: '#/components/schemas/EntitlementInfo' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Document' }
              }
            }
          },
          '202': {
            description: 'Accepted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['correlationId', 'documentId'],
                  properties: {
                    correlationId: { type: 'string' },
                    documentId: { type: 'string' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '413': { $ref: '#/components/responses/PayloadTooLarge' },
          '415': { $ref: '#/components/responses/UnsupportedMediaType' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    }
  }
};