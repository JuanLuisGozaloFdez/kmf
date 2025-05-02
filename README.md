# Document Management System

This project is a document management system that includes features for managing documents, attachments, entitlement, and transaction logging. It also integrates monitoring using Prometheus, Loki, and Grafana.

## Prerequisites

1. **Node.js**: Install Node.js (version 14 or higher).
2. **MySQL**: Install and configure MySQL.
3. **Prometheus**: Install Prometheus for monitoring.
4. **Loki**: Install Loki for log aggregation.
5. **Grafana**: Install Grafana for visualization.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd kmf
```

## 2. Install Dependencies

Run the following command to install all required npm packages:

```bash
npm install
```

## 3. Configure MySQL Database

1. Create a MySQL database named document_management.
2. Update the data/dbconfig.ts file with your MySQL Credentials:

```typescript
export const sequelize = new Sequelize('document_management', 'username', 'password', {
  host: 'localhost',
  dialect: 'mysql',
});
```

3. Run the SQL script in data/dbConfig.sql to create the required tables:

```bash
mysql -u <username> -p document_management < data/dbConfig.sql
```

4. Configure Prometheus

>>1. Add the following job to your Prometheus configuration file (prometheus.yml):

```yaml
scrape_configs:
  - job_name: 'document_management'
    static_configs:
      - targets: ['localhost:3000']
```
>>2. Restart Prometheus to apply the changes

5. Configure Loki

>> 1. Install Loki and configure it to collect logs from your application.
>> 2. Use a log shipper like promtail to forward logs to Loki.
>> 3. Ensure your application logs are written to a file (e.g., combined.log) that Loki can read.

6. Configure Grafana
Add Prometheus and Loki as data sources in Grafana.
Create dashboards to visualize metrics and logs.
7. Start the Application
Run the following command to start the application:

```bash
npm start
```

The application will be available at http://localhost:3000.

8.Access Metrics
Prometheus metrics are exposed at the /metrics endpoint: http://localhost:3000/metrics

## Additional Notes

- Ensure that the MySQL service is running before starting the application.
- Use Grafana to monitor application performance and logs.
- For any issues, refer to the logs in combined.log and error.log.

## License
This project is licensed under the MIT License. ```

# Documents API

The Documents API allows authorized users to upload, view and share supply chain documents, such as facility certificates and audit reports, along with their related properties and attachments.

## Base URL

All API endpoints are prefixed with: `/kmf/api/documents/v1`

## Document Types and Properties

A document definition consists of:

- Document properties
- Content file (PDF, text, PNG, JPEG or GIF format)
- Optional file attachments

### Available Document Types

- Generic Document
- Generic Certificate  
- GAA BAP Certificate

Use `GET /categories` to view all available document types and `GET /templates/{documentType}` to view required properties for a specific type.

## Document Linking

Documents can be linked to:

### Traceable Elements (Only one type allowed)

- Facilities (via `locationGLNList`)
- Products (via `productList`)
- Organizations (via `organizationList`)
- EPCs (via `epcList`)

### Additional Links

- EPCIS events (via `eventIDList`)
- Business transactions (via `transactionIDList`)

## Document Sharing

### Default Access

Documents are created with `private` entitlement by default, viewable only by the owning organization.

### Sharing Methods

1. **Linked Documents**
   - Set `entitlementMode` to `linked`
   - Organizations with access to associated elements can view the document
   - Only evaluates: `locationGLNList`, `productList`, `organizationList`, `epcList`

2. **Explicit Sharing**
   - Use `entitledOrgIds` to specify organizations
   - Works for both `private` and `linked` documents

## API Endpoints

### Documents

#### `POST /documents`

Creates a new document with properties, content, and entitlement information.

- Request: `multipart/form-data`
- Parts:
  - `properties` (required): JSON document properties
  - `content`: File upload (max 20MB)
  - `entitlement`: JSON entitlement info
- Responses: 201 (Created), 202 (Accepted)

#### `GET /documents`

Retrieves information about multiple documents.

- Query Parameters:
  - `docIds[]`: Array of document IDs to retrieve
- Returns: Array of document information including properties and attachment references
- Use `GET /documents/{docId}/content` to download actual document contents

#### `GET /documents/{docId}`

Retrieves document information and metadata.

#### `PUT /documents/{docId}`

Updates document properties, content, and entitlement.

- Supports both `application/json` and `multipart/form-data`

#### `DELETE /documents/{docId}`

Permanently deletes a document.

### Document Content

#### `GET /documents/{docId}/content`

Downloads document content file.

#### `PUT /documents/{docId}/content`

Updates document content file.

- Max file size: 20MB
- Supported formats: PDF, text, PNG, JPEG, GIF

### Entitlements

#### `GET /documents/{docId}/entitlement`

Retrieves document sharing settings.

#### `PUT /documents/{docId}/entitlement`

Updates document sharing settings.

- Modes: `private`, `linked`
- Optional: `entitledOrgIds`

### Attachments

#### `POST /documents/{docId}/attachments`

Adds new attachment to document.

- Max file size: 20MB
- Supported formats: PDF, text, PNG, JPEG, GIF

#### `GET /documents/{docId}/attachments/{attachmentId}`

Downloads specific attachment.

#### `PUT /documents/{docId}/attachments/{attachmentId}`

Updates existing attachment.

#### `DELETE /documents/{docId}/attachments/{attachmentId}`

Removes attachment from document.

### Search

#### `POST /documents/search`

Searches documents using multiple criteria:

- Organization IDs
- Timestamps
- Categories
- Document properties
- Associated elements

### Categories & Templates

#### `GET /categories`

Lists all available document categories.

#### `GET /templates/{documentType}`

Retrieves template for specific document type.

### Transactions

#### `GET /transactions`

Checks status of asynchronous operations using correlation IDs.

## File Size Limits

- Document properties (JSON): 20KB
- Content files: 20MB
- Attachments: 20MB

## Error Responses

- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 410: Gone
- 413: Payload Too Large
- 415: Unsupported Media Type
- 500: Internal Server Error

## Custom Properties

Custom properties must be specified in an array using the `customProperties` field:

```json
{
  "customProperties": [
    {
      "name": "Age",
      "value": 5
    },
    {
      "name": "Related product",
      "value": "95011015300038",
      "format": "gtin"
    }
  ]
}
```

Supported formats:

- `date`: ISO 8601 (YYYY-MM-DD)
- `date-time`: ISO 8601 (YYYY-MM-DDThh:mm:ss.mmmZ)
- `gln`: GS1 GLN or IBM location ID
- `gtin`: GS1 GTIN or IBM product ID
- `uri`: Full URI/URL
