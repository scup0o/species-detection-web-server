const sendResponse = (res, success, statusCode, message, data, pagination, errorDetails) => {
    const responseObject = { success, message };
    if (data !== undefined) responseObject.data = data;
    if (pagination !== undefined) responseObject.pagination = pagination;
    if (errorDetails !== undefined && process.env.NODE_ENV === 'development') {
        responseObject.errorDetails = errorDetails;
    }
    res.status(statusCode).json(responseObject);
};

const success = (res, data, statusCode = 200, message = 'Request was successful.') => {
    sendResponse(res, true, statusCode, message, data);
};

const error = (res, message = 'An error occurred.', statusCode = 500, errorDetails = null) => {
    sendResponse(res, false, statusCode, message, undefined, undefined, errorDetails);
};

const pagedSuccess = (res, data, paginationInfo, statusCode = 200, message = 'Request was successful.') => {
    sendResponse(res, true, statusCode, message, data, paginationInfo);
};

module.exports = { success, error, pagedSuccess };