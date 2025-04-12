import { DocumentTemplate } from '../types';

export const documentTemplates: Record<string, DocumentTemplate> = {
  'Generic Document': {
    type: 'Generic Document',
    requiredProperties: ['title', 'description'],
    allowedFileTypes: ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/gif']
  },
  'Generic Certificate': {
    type: 'Generic Certificate',
    requiredProperties: ['title', 'issuer', 'validFrom', 'validTo'],
    allowedFileTypes: ['application/pdf', 'image/png', 'image/jpeg']
  },
  'GAA BAP Certificate': {
    type: 'GAA BAP Certificate',
    requiredProperties: ['certificateNumber', 'facility', 'issuer', 'validFrom', 'validTo', 'auditDate'],
    allowedFileTypes: ['application/pdf']
  }
};