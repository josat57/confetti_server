import documentService from '../services/document.service.js';
import { AppError } from '../utils/error.js';
import { logger } from '../utils/logger.js';

// Upload document
export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const document = await documentService.uploadDocument(
      req.file,
      req.user._id,
      req.body.metadata
    );

    res.status(201).json({
      status: 'success',
      data: document
    });
  } catch (error) {
    next(error);
  }
};

// Get document by ID
export const getDocument = async (req, res, next) => {
  try {
    const document = await documentService.getDocument(
      req.params.documentId,
      req.user
    );

    res.status(200).json({
      status: 'success',
      data: document
    });
  } catch (error) {
    next(error);
  }
};

// Get documents by owner
export const getDocumentsByOwner = async (req, res, next) => {
  try {
    const documents = await documentService.getDocumentsByOwner(
      req.user._id,
      {
        type: req.query.type,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 50,
        skip: parseInt(req.query.skip) || 0
      }
    );

    res.status(200).json({
      status: 'success',
      data: documents
    });
  } catch (error) {
    next(error);
  }
};

// Get documents by event
export const getDocumentsByEvent = async (req, res, next) => {
  try {
    const documents = await documentService.getDocumentsByEvent(
      req.params.eventId,
      {
        type: req.query.type,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 50,
        skip: parseInt(req.query.skip) || 0
      }
    );

    res.status(200).json({
      status: 'success',
      data: documents
    });
  } catch (error) {
    next(error);
  }
};

// Get documents by vendor
export const getDocumentsByVendor = async (req, res, next) => {
  try {
    const documents = await documentService.getDocumentsByVendor(
      req.params.vendorId,
      {
        type: req.query.type,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 50,
        skip: parseInt(req.query.skip) || 0
      }
    );

    res.status(200).json({
      status: 'success',
      data: documents
    });
  } catch (error) {
    next(error);
  }
};

// Update document
export const updateDocument = async (req, res, next) => {
  try {
    const document = await documentService.updateDocument(
      req.params.documentId,
      req.user._id,
      req.body
    );

    res.status(200).json({
      status: 'success',
      data: document
    });
  } catch (error) {
    next(error);
  }
};

// Delete document
export const deleteDocument = async (req, res, next) => {
  try {
    const document = await documentService.deleteDocument(
      req.params.documentId,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      data: document
    });
  } catch (error) {
    next(error);
  }
};

// Archive document
export const archiveDocument = async (req, res, next) => {
  try {
    const document = await documentService.archiveDocument(
      req.params.documentId,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      data: document
    });
  } catch (error) {
    next(error);
  }
};

// Add document version
export const addVersion = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const document = await documentService.addVersion(
      req.params.documentId,
      req.user._id,
      req.file,
      req.body.changes
    );

    res.status(200).json({
      status: 'success',
      data: document
    });
  } catch (error) {
    next(error);
  }
};

// Update document permissions
export const updatePermissions = async (req, res, next) => {
  try {
    const document = await documentService.updatePermissions(
      req.params.documentId,
      req.user._id,
      req.body.permissions
    );

    res.status(200).json({
      status: 'success',
      data: document
    });
  } catch (error) {
    next(error);
  }
};

// Get document statistics
export const getDocumentStats = async (req, res, next) => {
  try {
    const stats = await documentService.getDocumentStats(req.user._id);

    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    next(error);
  }
}; 