# KMF API Documentation

## Overview
KMF provides a robust set of APIs for managing documents, attachments, transactions, and entitlements. The APIs are organized into groups for streamlined functionality.

## Base Path
All API endpoints are prefixed with:

---

## API Endpoints

### Documents


### **Document Content Management**

- **`GET /documents/{docId}/content`**
  - Retrieves the content of a specified document.
  - Handles `404` if the document content is not found.

- **`PUT /documents/{docId}/content`**
  - Updates the content of a specified document.
  - Validates uploaded file types and returns relevant error codes:
    - `400` for missing files.
    - `415` for unsupported media types.
  - Handles `404` if the document is not found.

---

### **Document Entitlement Management**

- **`GET /documents/{docId}/entitlement`**
  - Retrieves the entitlement information associated with a document.
  - Handles `404` if the document is not found.

- **`PUT /documents/{docId}/entitlement`**
  - Updates the entitlement information for a document.
  - Validates entitlement properties and returns:
    - `400` for validation errors.
    - `404` if the document is not found.

---

### **Attachment Management**

- **`POST /documents/{docId}/attachments`**
  - Adds a new attachment to a document.
  - Returns:
    - `400` for missing files.
    - `201` upon successful creation with a correlation ID.

- **`GET /documents/{docId}/attachments/{attachmentId}`**
  - Retrieves a specific attachment by its ID.
  - Handles `404` if the attachment is not found.

- **`PUT /documents/{docId}/attachments/{attachmentId}`**
  - Updates an existing attachment.
  - Returns:
    - `400` for missing files.
    - `404` if the attachment is not found.

- **`DELETE /documents/{docId}/attachments/{attachmentId}`**
  - Deletes a specific attachment.
  - Handles `404` if the attachment is not found.

---

### **Document Creation and Validation**

- **`POST /documents`**
  - Creates a new document with the following steps:
    - Validates document properties and entitlements.
    - Handles file uploads and validates file types.
    - Generates a correlation ID for asynchronous processing.
  - Returns:
    - `201` for successful creation.
    - `202` if the creation is in progress.
    - Error codes for validation issues:
      - `400` for missing fields or invalid data.
      - `413` for file size limits.
      - `415` for unsupported media types.

---

### **Transaction Management**

- **`GET /transactions`**
  - Retrieves the status of transactions by their correlation IDs.
  - Requires `correlationIds[]` as a query parameter.
  - Returns:
    - `400` if the `correlationIds[]` parameter is missing.
    - `200` with transaction statuses.

---

## Error Handling
The APIs include robust error handling for:

- `400` - Bad Request: For missing or invalid fields.
- `404` - Not Found: For non-existent resources.
- `413` - Payload Too Large: For exceeding file size limits.
- `415` - Unsupported Media Type: For invalid file types.
- `500` - Internal Server Error: For unexpnpm run startected server errors.

---

## Running the Project
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
3. Start the server
   ```bash
   npm run start
4. Access APIs at
   http://localhost:3000/kmf/api/documents/v1

## Development
- Language: TypeScript
- Framework: Express.js

## Future Enhancements
- Full implementation of storage and retrieval logic for documents, attachments, and transactions.
- Detailed logging and monitoring for API usage.

For more details, refer to the source code:
- Documents Routes
- Server Setup
