const Joi = require('joi');
const { error } = require('../middlewares/responseHandler');

const getSpeciesSchema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1), // Thêm default cho page
    pageSize: Joi.number().integer().min(1).max(50).optional().default(10), // Max 50, default 10
    searchQuery: Joi.string().trim().optional().allow(''),
    classId: Joi.string().trim().optional().allow(''), // "0" or actual ID
    languageCode: Joi.string().trim().lowercase().length(2).optional().default('en'), // Default 'en'
    lastVisibleDocId: Joi.string().trim().optional().allow('')
});

const getSpeciesByIdsSchema = Joi.object({
    ids: Joi.string().required().regex(/^[a-zA-Z0-9,]+$/) // Chỉ cho phép chữ, số và dấu phẩy
        .custom((value, helpers) => {
            const idArray = value.split(',').map(id => id.trim()).filter(id => id);
            if (idArray.length === 0) {
                return helpers.error('any.invalid', { message: 'IDs string cannot result in an empty list after parsing.' });
            }
            if (idArray.length > 30) {
                return helpers.error('any.length', { limit: 30, message: 'Maximum 30 IDs can be requested.' });
            }
            return idArray.join(','); // Return cleaned string
        }, 'Comma-separated IDs validation'),
    languageCode: Joi.string().trim().lowercase().length(2).optional().default('en'),
});

const getSpeciesClassesSchema = Joi.object({
    languageCode: Joi.string().trim().lowercase().length(2).optional().default('en'),
});


const validate = (schema, source = 'query') => (req, res, next) => {
    const dataToValidate = source === 'body' ? req.body : req.query;
    const { error: validationError, value: validatedValue } = schema.validate(dataToValidate, {
        abortEarly: false, // Hiển thị tất cả lỗi
        allowUnknown: true, // Bỏ qua các trường không định nghĩa trong schema
        stripUnknown: true, // Loại bỏ các trường không định nghĩa (an toàn hơn)
    });

    if (validationError) {
        const errorMessage = validationError.details.map(detail => detail.message).join('; ');
        return error(res, `Validation Error: ${errorMessage}`, 400, validationError.details);
    }
    // Gán giá trị đã được validate (và có thể đã có default) vào lại req.query hoặc req.body
    if (source === 'body') {
        req.body = validatedValue;
    } else {
        req.query = validatedValue;
    }
    next();
};

module.exports = {
    validateGetSpecies: validate(getSpeciesSchema, 'query'),
    validateGetSpeciesByIds: validate(getSpeciesByIdsSchema, 'query'),
    validateGetSpeciesClasses: validate(getSpeciesClassesSchema, 'query'),
};