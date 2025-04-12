export type DocumentType = 'Generic Document' | 'Generic Certificate' | 'GAA BAP Certificate';

export type EntitlementMode = 'private' | 'linked';

export interface DocumentTemplate {
  type: DocumentType;
  requiredProperties: string[];
  allowedFileTypes: string[];
}

export interface DocumentEntitlement {
  mode: EntitlementMode;
  entitledOrgIds?: string[];
}

export interface DocumentAssociations {
  locationGLNList?: string[];    // Facility IDs
  productList?: string[];        // Product IDs
  organizationList?: string[];   // Organization IDs
  epcList?: string[];           // Product EPCs
  eventIDList?: string[];       // EPCIS Event IDs
  transactionIDList?: string[]; // Transaction IDs
}

export interface CustomProperty {
  name: string;
  value: string | number;
  format?: 'date' | 'date-time' | 'gln' | 'gtin' | 'uri';
}

export interface DocumentProperties {
  documentType: DocumentType;
  documentTitle: string;
  issueDate?: string;
  expiryDate?: string;
  tagList?: string[];
  customProperties?: CustomProperty[];
  locationGLNList?: string[];
  productList?: string[];
  organizationList?: string[];
  epcList?: string[];
  eventIDList?: string[];
  transactionIDList?: string[];
}

export interface Document {
  id: string;
  type: DocumentType;
  properties: DocumentProperties;
  contentFile: string;
  attachments?: string[];
  associations: DocumentAssociations;
  entitlement: DocumentEntitlement;
  version?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  organizationId: string;
}

export interface SearchConditions {
  orgId?: string[];
  orgIdNot?: string[];
  timestamp?: string | { from?: string; to?: string };
  categories?: string[];
  properties?: Partial<DocumentProperties>;
}

export interface SearchResults {
  total: number;
  offset: number;
  limit: number;
  documents: Document[];
}

export interface Transaction {
  correlationId: string;
  status: 'pending' | 'completed' | 'failed';
  documentId?: string;
  error?: string;
}

export interface Transactions {
  transactions: Transaction[];
}