const { error } = require('../middlewares/responseHandler');

// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (err, req, res, next) => {
    console.error("GLOBAL ERROR HANDLER:", err.name, "-", err.message);
    if (process.env.NODE_ENV === 'development' && err.stack) {
        console.error(err.stack);
    }

    let statusCode = err.statusCode || 500;
    let message = err.message || 'An unexpected error occurred on the server.';

    // Xử lý các lỗi cụ thể
    if (err.name === 'ValidationError') { // Lỗi từ Joi (nếu không bắt ở middleware validator)
        statusCode = 400;
        message = 'Validation Failed: ' + err.details.map(d => d.message).join(', ');
    }
    // Thêm các loại lỗi khác nếu cần (ví dụ: lỗi xác thực, lỗi database cụ thể)

    return error(res, message, statusCode, err.stack); // Chỉ gửi stack ở dev
};

const routeNotFoundHandler = (req, res, next) => {
    return error(res, `The requested resource was not found: ${req.method} ${req.originalUrl}`, 404);
};

module.exports = { globalErrorHandler, routeNotFoundHandler };