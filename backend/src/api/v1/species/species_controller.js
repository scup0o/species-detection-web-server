const speciesService = require('../species/species_service');
const { pagedSuccess, success, error } = require('../../../middlewares/responseHandler');

const getAllSpecies = async (req, res, next) => {
    try {
        // req.query đã được validate và có thể có giá trị default
        const result = await speciesService.getSpeciesList(req.query);
        return pagedSuccess(res, result.items, result.pagination);
    } catch (err) {
        next(err); // Chuyển cho global error handler
    }
};

const getSpeciesByIds = async (req, res, next) => {
    try {
        const { ids, languageCode } = req.query; // Đã được validate
        const idList = ids.split(','); // Validator đã đảm bảo ids là chuỗi hợp lệ

        const result = await speciesService.getSpeciesByIdsList(idList, languageCode);
        return pagedSuccess(res, result.items, result.pagination);
    } catch (err) {
        next(err);
    }
};

// Controller cho Species Classes
const getAllSpeciesClasses = async (req, res, next) => {
    try {
        const { languageCode } = req.query; // Đã được validate
        const classes = await speciesService.getSpeciesClassesList(languageCode);
        // Trả về response dạng list đơn giản, không paged
        // Hoặc bạn có thể tạo một response DTO riêng cho classes nếu cần
        return success(res, classes);
    } catch (err) {
        next(err);
    }
};


module.exports = {
    getAllSpecies,
    getSpeciesByIds,
    getAllSpeciesClasses, // Thêm controller này
};