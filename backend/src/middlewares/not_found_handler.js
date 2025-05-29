const ApiError = require('../app/api_error');

function notFoundHandler(req, res, next) {
  // Chỉ áp dụng cho các request API không khớp
  if (req.originalUrl.startsWith('/api/')) {
     return next(new ApiError(404, 'Resource not found'));
  }
  // Nếu không phải API, cho qua để các handler khác (như SPA fallback) xử lý
  next();
}

module.exports = notFoundHandler;