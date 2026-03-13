/**
 * Validation Middleware
 * Validates request data using Joi schemas
 */

const FIELD_LABELS = {
  name: 'nombre',
  contact_name: 'nombre del contacto',
  document: 'documento',
  email: 'email',
  phone: 'teléfono',
  address: 'dirección',
  notes: 'notas',
  note: 'nota',
  is_active: 'estado activo',
  page: 'página',
  limit: 'límite',
  id: 'id'
};

function getFieldLabel(field) {
  return FIELD_LABELS[field] || field.replace(/_/g, ' ');
}

function formatJoiMessage(detail) {
  const field = detail.path.join('.');
  const fieldLabel = getFieldLabel(field);
  const value = detail.context?.value;

  if ((value === null || value === undefined) && ['string.base', 'number.base', 'boolean.base'].includes(detail.type)) {
    return `El campo ${fieldLabel} es obligatorio`;
  }

  const messagesByType = {
    'any.required': `El campo ${fieldLabel} es obligatorio`,
    'string.empty': `El campo ${fieldLabel} es obligatorio`,
    'string.base': `El campo ${fieldLabel} debe ser un texto`,
    'string.email': `El campo ${fieldLabel} debe ser un email válido`,
    'string.max': `El campo ${fieldLabel} no puede exceder ${detail.context?.limit} caracteres`,
    'string.min': `El campo ${fieldLabel} debe tener al menos ${detail.context?.limit} caracteres`,
    'number.base': `El campo ${fieldLabel} debe ser un número`,
    'number.min': `El campo ${fieldLabel} debe ser mayor o igual a ${detail.context?.limit}`,
    'number.max': `El campo ${fieldLabel} debe ser menor o igual a ${detail.context?.limit}`,
    'number.positive': `El campo ${fieldLabel} debe ser un número positivo`,
    'boolean.base': `El campo ${fieldLabel} debe ser verdadero o falso`,
    'array.base': `El campo ${fieldLabel} debe ser una lista`,
    'array.min': `El campo ${fieldLabel} debe contener al menos ${detail.context?.limit} elemento(s)`,
    'any.only': `El campo ${fieldLabel} contiene un valor no permitido`,
    'date.base': `El campo ${fieldLabel} debe ser una fecha válida`,
    'string.guid': `El campo ${fieldLabel} debe ser un UUID válido`
  };

  return messagesByType[detail.type] || detail.message.replace(/"/g, '');
}

function buildValidationError(error) {
  return error.details.map((detail) => formatJoiMessage(detail));
}

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const details = buildValidationError(error);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Error de validación',
          details,
        },
      });
    }
    
    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const details = buildValidationError(error);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Error de validación',
          details,
        },
      });
    }
    
    req.query = value;
    next();
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const details = buildValidationError(error);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Error de validación',
          details,
        },
      });
    }
    
    req.params = value;
    next();
  };
};

module.exports = {
  validate,
  validateQuery,
  validateParams,
};
