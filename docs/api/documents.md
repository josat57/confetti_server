# Document Management API

## Overview

The Document Management API provides endpoints for handling file uploads, document management, and access control. It supports various document types including images, videos, and general documents.

## Base URL

```
/api/v1/documents
```

## Authentication

All endpoints require authentication using a JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Upload Document

Upload a new document.

```
POST /
```

**Request**
- Content-Type: multipart/form-data
- Body:
  - file: The file to upload (required)
  - metadata: Additional document metadata (optional)

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "document_id",
    "name": "document_name",
    "type": "image",
    "mimeType": "image/jpeg",
    "size": 1024,
    "url": "file_url",
    "thumbnail": "thumbnail_url",
    "owner": "user_id",
    "status": "processing",
    "metadata": {
      "width": 800,
      "height": 600
    },
    "permissions": {
      "public": false,
      "allowedUsers": [],
      "allowedRoles": []
    },
    "timestamps": {
      "uploaded": "2024-03-20T10:00:00Z",
      "processed": null
    }
  }
}
```

### Get Document

Retrieve a document by ID.

```
GET /:documentId
```

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "document_id",
    "name": "document_name",
    "type": "image",
    "mimeType": "image/jpeg",
    "size": 1024,
    "url": "file_url",
    "thumbnail": "thumbnail_url",
    "owner": "user_id",
    "status": "active",
    "metadata": {
      "width": 800,
      "height": 600
    },
    "permissions": {
      "public": false,
      "allowedUsers": [],
      "allowedRoles": []
    },
    "timestamps": {
      "uploaded": "2024-03-20T10:00:00Z",
      "processed": "2024-03-20T10:00:05Z"
    }
  }
}
```

### Get Documents by Owner

Retrieve documents owned by the authenticated user.

```
GET /owner
```

**Query Parameters**
- type: Filter by document type (optional)
- status: Filter by document status (optional)
- limit: Number of documents to return (default: 50)
- skip: Number of documents to skip (default: 0)

**Response**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "document_id",
      "name": "document_name",
      "type": "image",
      "mimeType": "image/jpeg",
      "size": 1024,
      "url": "file_url",
      "thumbnail": "thumbnail_url",
      "status": "active",
      "timestamps": {
        "uploaded": "2024-03-20T10:00:00Z",
        "processed": "2024-03-20T10:00:05Z"
      }
    }
  ]
}
```

### Get Documents by Event

Retrieve documents associated with an event.

```
GET /event/:eventId
```

**Query Parameters**
- type: Filter by document type (optional)
- status: Filter by document status (optional)
- limit: Number of documents to return (default: 50)
- skip: Number of documents to skip (default: 0)

**Response**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "document_id",
      "name": "document_name",
      "type": "image",
      "mimeType": "image/jpeg",
      "size": 1024,
      "url": "file_url",
      "thumbnail": "thumbnail_url",
      "status": "active",
      "timestamps": {
        "uploaded": "2024-03-20T10:00:00Z",
        "processed": "2024-03-20T10:00:05Z"
      }
    }
  ]
}
```

### Get Documents by Vendor

Retrieve documents associated with a vendor.

```
GET /vendor/:vendorId
```

**Query Parameters**
- type: Filter by document type (optional)
- status: Filter by document status (optional)
- limit: Number of documents to return (default: 50)
- skip: Number of documents to skip (default: 0)

**Response**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "document_id",
      "name": "document_name",
      "type": "image",
      "mimeType": "image/jpeg",
      "size": 1024,
      "url": "file_url",
      "thumbnail": "thumbnail_url",
      "status": "active",
      "timestamps": {
        "uploaded": "2024-03-20T10:00:00Z",
        "processed": "2024-03-20T10:00:05Z"
      }
    }
  ]
}
```

### Update Document

Update document details.

```
PATCH /:documentId
```

**Request Body**
```json
{
  "name": "new_name",
  "metadata": {
    "description": "Updated description"
  },
  "permissions": {
    "public": true,
    "allowedUsers": ["user_id"],
    "allowedRoles": ["admin"]
  }
}
```

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "document_id",
    "name": "new_name",
    "metadata": {
      "description": "Updated description"
    },
    "permissions": {
      "public": true,
      "allowedUsers": ["user_id"],
      "allowedRoles": ["admin"]
    }
  }
}
```

### Delete Document

Delete a document.

```
DELETE /:documentId
```

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "document_id",
    "status": "deleted"
  }
}
```

### Archive Document

Archive a document.

```
POST /:documentId/archive
```

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "document_id",
    "status": "archived"
  }
}
```

### Add Document Version

Add a new version of a document.

```
POST /:documentId/version
```

**Request**
- Content-Type: multipart/form-data
- Body:
  - file: The new version file (required)
  - changes: Description of changes (required)

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "document_id",
    "version": {
      "current": 2,
      "history": [
        {
          "version": 2,
          "url": "new_file_url",
          "size": 1024,
          "mimeType": "image/jpeg",
          "userId": "user_id",
          "changes": "Updated image quality",
          "timestamp": "2024-03-20T11:00:00Z"
        }
      ]
    }
  }
}
```

### Update Document Permissions

Update document access permissions.

```
PATCH /:documentId/permissions
```

**Request Body**
```json
{
  "permissions": {
    "public": true,
    "allowedUsers": ["user_id"],
    "allowedRoles": ["admin"]
  }
}
```

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "document_id",
    "permissions": {
      "public": true,
      "allowedUsers": ["user_id"],
      "allowedRoles": ["admin"]
    }
  }
}
```

### Get Document Statistics

Get document statistics for the authenticated user.

```
GET /stats
```

**Response**
```json
{
  "status": "success",
  "data": {
    "total": 100,
    "totalSize": 1024000,
    "byType": [
      {
        "type": "image",
        "count": 50,
        "size": 512000
      },
      {
        "type": "document",
        "count": 50,
        "size": 512000
      }
    ],
    "byStatus": [
      {
        "status": "active",
        "count": 80
      },
      {
        "status": "archived",
        "count": 20
      }
    ]
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "No file uploaded"
}
```

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Please log in to access this resource"
}
```

### 403 Forbidden
```json
{
  "status": "error",
  "message": "Not authorized to access this document"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Document not found"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Failed to process document"
}
```

## Best Practices

1. **File Uploads**:
   - Use appropriate file types and sizes
   - Implement client-side validation
   - Handle upload progress and errors
   - Consider using chunked uploads for large files

2. **Document Management**:
   - Keep track of document versions
   - Implement proper access control
   - Clean up unused documents
   - Monitor storage usage

3. **Performance**:
   - Use pagination for large result sets
   - Implement caching for frequently accessed documents
   - Optimize image and video processing
   - Consider CDN integration for better delivery

4. **Security**:
   - Validate file types and content
   - Implement proper access control
   - Use secure file storage
   - Monitor for suspicious activity

## Example Usage

### Upload Document
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('metadata', JSON.stringify({
  description: 'Event photo'
}));

const response = await fetch('/api/v1/documents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
```

### Get Documents with Pagination
```javascript
const response = await fetch('/api/v1/documents/owner?limit=10&skip=0', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();
```

### Update Document Permissions
```javascript
const response = await fetch(`/api/v1/documents/${documentId}/permissions`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    permissions: {
      public: true,
      allowedUsers: ['user_id'],
      allowedRoles: ['admin']
    }
  })
});

const result = await response.json();
``` 