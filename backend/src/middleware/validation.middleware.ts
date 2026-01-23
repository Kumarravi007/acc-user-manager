import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

/**
 * Middleware factory for request validation using Joi schemas
 * @param schema - Joi schema object with optional body, query, and params properties
 * @returns Express middleware function
 */
export const validate = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationErrors: string[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        error.details.forEach((detail) => {
          validationErrors.push(detail.message);
        });
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        error.details.forEach((detail) => {
          validationErrors.push(detail.message);
        });
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        error.details.forEach((detail) => {
          validationErrors.push(detail.message);
        });
      }
    }

    // If validation errors exist, return 400 Bad Request
    if (validationErrors.length > 0) {
      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        errors: validationErrors,
      });

      res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
      });
      return;
    }

    next();
  };
};

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  // UUID parameter validation
  uuidParam: Joi.object({
    id: Joi.string().uuid().required(),
  }),

  // Project ID parameter validation
  projectIdParam: Joi.object({
    projectId: Joi.string().required(),
  }),

  // Execution ID parameter validation
  executionIdParam: Joi.object({
    executionId: Joi.string().uuid().required(),
  }),

  // Pagination query validation
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),

  // Email validation
  email: Joi.string().email().required(),

  // Email array validation
  emails: Joi.array().items(Joi.string().email()).min(1).max(50),
};

/**
 * Validation schemas for bulk operations
 */
export const bulkOperationSchemas = {
  // Preview bulk operation
  preview: {
    body: Joi.object({
      projectIds: Joi.array()
        .items(Joi.string().required())
        .min(1)
        .max(100)
        .required()
        .messages({
          'array.min': 'At least one project must be selected',
          'array.max': 'Cannot preview more than 100 projects at once',
        }),
      emails: Joi.array()
        .items(Joi.string().email().required())
        .min(1)
        .max(50)
        .required()
        .messages({
          'array.min': 'At least one email must be provided',
          'array.max': 'Cannot add more than 50 users at once',
        }),
      roleIds: Joi.array()
        .items(Joi.string().required())
        .min(1)
        .required()
        .messages({
          'array.min': 'At least one role must be assigned',
        }),
    }),
  },

  // Assign users to projects
  assign: {
    body: Joi.object({
      projectIds: Joi.array()
        .items(Joi.string().required())
        .min(1)
        .max(100)
        .required()
        .messages({
          'array.min': 'At least one project must be selected',
          'array.max': 'Cannot assign to more than 100 projects at once',
        }),
      emails: Joi.array()
        .items(Joi.string().email().required())
        .min(1)
        .max(50)
        .required()
        .messages({
          'array.min': 'At least one email must be provided',
          'array.max': 'Cannot add more than 50 users at once',
        }),
      roleIds: Joi.array()
        .items(Joi.string().required())
        .min(1)
        .required()
        .messages({
          'array.min': 'At least one role must be assigned',
        }),
    }),
  },

  // Get execution status
  getStatus: {
    params: commonSchemas.executionIdParam,
  },

  // Get history with pagination
  getHistory: {
    query: commonSchemas.paginationQuery,
  },
};

/**
 * Validation schemas for project operations
 */
export const projectSchemas = {
  // Get projects with optional filters
  getProjects: {
    query: Joi.object({
      search: Joi.string().max(100).optional(),
      status: Joi.string().valid('active', 'archived').optional(),
      ...commonSchemas.paginationQuery.describe().keys,
    }),
  },

  // Get single project
  getProject: {
    params: commonSchemas.projectIdParam,
  },

  // Get project users
  getProjectUsers: {
    params: commonSchemas.projectIdParam,
    query: commonSchemas.paginationQuery,
  },

  // Get project roles
  getProjectRoles: {
    params: commonSchemas.projectIdParam,
  },
};

export default validate;
