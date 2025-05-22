# Document Management System

This project is a document management system that includes features for managing documents, attachments, entitlement, and transaction logging. It also integrates monitoring using Prometheus, Loki, and Grafana.
This README file is structured in three sections:

- Instructions for installation
- API
- DB migration process

## Instructions for installation

### Prerequisites

1. **Node.js**: Install Node.js (version 14 or higher).
2. **MySQL**: Install and configure MySQL.
3. **Prometheus**: Install Prometheus for monitoring.
4. **Loki**: Install Loki for log aggregation.
5. **Grafana**: Install Grafana for visualization.

### Setup Instructions

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd kmf
```

#### 2. Install Dependencies

Run the following command to install all required npm packages:

```bash
npm install
```

#### 3. Configure MySQL Database

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

#### 4. Configure Prometheus

1. Add the following job to your Prometheus configuration file (prometheus.yml):

```yaml
scrape_configs:
  - job_name: 'document_management'
    static_configs:
      - targets: ['localhost:3000']
```

2. Restart Prometheus to apply the changes

#### 5. Configure Loki

1. Install Loki and configure it to collect logs from your application.
2. Use a log shipper like promtail to forward logs to Loki.
3. Ensure your application logs are written to a file (e.g., combined.log) that Loki can read.

#### 6. Configure Grafana

Add Prometheus and Loki as data sources in Grafana.
Create dashboards to visualize metrics and logs.

#### 7. Configure Secrets

- Use a Secrets Manager:

For production environments, use a secrets manager like AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault to securely store and retrieve sensitive information.

- Encrypt .env Files:

If .env files are used, ensure they are encrypted and not included in version control.

#### 8. Build and Start the Application

Before starting the application, build the TypeScript source code:

```bash
npm run build
```

Then start the application:

```bash
npm start
```

The application will be available at <http://localhost:3000>.

#### 9. Access Metrics

Prometheus metrics are exposed at the /metrics endpoint: <http://localhost:3000/metrics>

### Additional Notes

- Ensure that the MySQL service is running before starting the application.
- Use Grafana to monitor application performance and logs.
- For any issues, refer to the logs in combined.log and error.log.

### License

This project is licensed under the MIT License.

## Documents API

### Base URL for Documents API

All API endpoints are prefixed with: `/kmf/api/documents/v1`

### Document Types and Properties

A document definition consists of:

- Document properties
- Content file (PDF, text, PNG, JPEG or GIF format)
- Optional file attachments

#### Available Document Types

- Generic Document
- Generic Certificate  
- GAA BAP Certificate

Use `GET /categories` to view all available document types and `GET /templates/{documentType}` to view required properties for a specific type.

### Document Linking

Documents can be linked to:

#### Traceable Elements (Only one type allowed)

- Facilities (via `locationGLNList`)
- Products (via `productList`)
- Organizations (via `organizationList`)
- EPCs (via `epcList`)

#### Additional Links

- EPCIS events (via `eventIDList`)
- Business transactions (via `transactionIDList`)

### Document Sharing

#### Default Access

Documents are created with `private` entitlement by default, viewable only by the owning organization.

#### Sharing Methods

1. **Linked Documents**
   - Set `entitlementMode` to `linked`
   - Organizations with access to associated elements can view the document
   - Only evaluates: `locationGLNList`, `productList`, `organizationList`, `epcList`

2. **Explicit Sharing**
   - Use `entitledOrgIds` to specify organizations
   - Works for both `private` and `linked` documents

### API Endpoints

#### Documents

##### `POST /documents`

Creates a new document with properties, content, and entitlement information.

- Request: `multipart/form-data`
- Parts:
  - `properties` (required): JSON document properties
  - `content`: File upload (max 20MB)
  - `entitlement`: JSON entitlement info
- Responses: 201 (Created), 202 (Accepted)

##### `GET /documents`

Retrieves information about multiple documents.

- Query Parameters:
  - `docIds[]`: Array of document IDs to retrieve
- Returns: Array of document information including properties and attachment references
- Use `GET /documents/{docId}/content` to download actual document contents

##### `POST /documents/search`

Searches documents using multiple criteria:

- Organization IDs
- Timestamps
- Categories
- Document properties
- Associated elements

#### Document Details

##### `GET /documents/{docId}`

Retrieves document information and metadata.

##### `PUT /documents/{docId}`

Updates document properties, content, and entitlement.

- Supports both `application/json` and `multipart/form-data`

##### `DELETE /documents/{docId}`

Permanently deletes a document.

#### Document Content

##### `GET /documents/{docId}/content`

Downloads document content file.

##### `PUT /documents/{docId}/content`

Updates document content file.

- Max file size: 20MB
- Supported formats: PDF, text, PNG, JPEG, GIF

#### Entitlements

##### `GET /documents/{docId}/entitlement`

Retrieves document sharing settings.

##### `PUT /documents/{docId}/entitlement`

Updates document sharing settings.

- Modes: `private`, `linked`
- Optional: `entitledOrgIds`

#### Attachments

##### `POST /documents/{docId}/attachments`

Adds new attachment to document.

- Max file size: 20MB
- Supported formats: PDF, text, PNG, JPEG, GIF

##### `GET /documents/{docId}/attachments/{attachmentId}`

Downloads specific attachment.

##### `PUT /documents/{docId}/attachments/{attachmentId}`

Updates existing attachment.

##### `DELETE /documents/{docId}/attachments/{attachmentId}`

Removes attachment from document.

#### Transactions

##### `GET /transactions`

Checks status of asynchronous operations using correlation IDs.

#### Categories & Templates

##### `GET /categories`

Lists all available document categories.

##### `GET /templates/{documentType}`

Retrieves template for specific document type.

#### Monitoring

##### `GET /metrics`

Exposes Prometheus metrics for monitoring application performance.

## Database Migrations

### Setting Up Migrations

1. **Install Sequelize CLI**  
   Run the following command to install Sequelize CLI as a development dependency:

   ```bash
   npm install --save-dev sequelize-cli
   ```

2. **Initialize Sequelize**  

   Run the following command to initialize Sequelize in your project:

   ```bash
   npx sequelize-cli init
   ```

   This will create the following folder structure:
  
  ```text
   migrations/
   models/
   seeders/
   config/
   ```
   
3. **Configure Sequelize for Migrations**  

   Update the config/config.js file to use environment variables for database credentials:

  ```javascript
   require('dotenv').config();

   module.exports = {
     development: {
       username: process.env.DB_USER,
       password: process.env.DB_PASSWORD,
       database: process.env.DB_NAME,
       host: process.env.DB_HOST,
       dialect: 'mysql',
     },
     test: {
       username: process.env.DB_USER,
       password: process.env.DB_PASSWORD,
       database: process.env.DB_NAME,
       host: process.env.DB_HOST,
       dialect: 'mysql',
     },
     production: {
       username: process.env.DB_USER,
       password: process.env.DB_PASSWORD,
       database: process.env.DB_NAME,
       host: process.env.DB_HOST,
       dialect: 'mysql',
     },
   };
   ```

4. **Create a Migration File**  
   Run the following command to create a new migration file:

   ```bash
   npx sequelize-cli migration:generate --name create-documents-table
   ```
  
   This will create a file in the migrations/ folder. Update the file to define the schema for the Documents table:
  
   ```javascript
   'use strict';

   module.exports = {
     up: async (queryInterface, Sequelize) => {
       await queryInterface.createTable('Documents', {
         id: {
           type: Sequelize.INTEGER,
           autoIncrement: true,
           primaryKey: true,
         },
         title: {
           type: Sequelize.STRING,
           allowNull: false,
         },
         createdAt: {
           type: Sequelize.DATE,
           allowNull: false,
         },
         updatedAt: {
           type: Sequelize.DATE,
           allowNull: false,
         },
       });
     },

     down: async (queryInterface, Sequelize) => {
       await queryInterface.dropTable('Documents');
     },
   };
   ```

5. **Run Migrations**  

   To apply migrations, run the following command:

   ```bash
   npx sequelize-cli db:migrate
   ```
  
   To undo the last migration, run:
  
   ```bash
   npx sequelize-cli db:migrate:undo
   ```

6. **Automate Migrations in Deployment**  

   Update the Jenkinsfile to include a step for running migrations during deployment:
  
   ```groovy
   stage('Run Migrations') {
       steps {
           sh 'npx sequelize-cli db:migrate'
       }
   }
   ```

### Managing Migrations

#### Running Migrations

To apply all pending migrations, run:

```bash
npx sequelize-cli db:migrate
```

#### Undoing Migrations

To undo the last migration, run:

```bash
npx sequelize-cli db:migrate:undo
```

#### Creating a New Migration

To create a new migration file, run:

```bash
npx sequelize-cli migration:generate --name <migration-name>
```

## Test Coverage

To check the test coverage, run:

```bash
npm run coverage
```

The coverage report will be generated in the `coverage/` directory.
