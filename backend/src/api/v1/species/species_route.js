const express = require('express');
const speciesController = require('../species/species_controller');
const {
    validateGetSpecies,
    validateGetSpeciesByIds,
    validateGetSpeciesClasses
} = require('../../../middlewares/validator');

const router = express.Router();

// Route cho Species
router.get('/', validateGetSpecies, speciesController.getAllSpecies);
router.get('/by-ids', validateGetSpeciesByIds, speciesController.getSpeciesByIds);
router.get('/detailed', validateGetSpeciesByIds, speciesController.getSpeciesByIdDetailed);



module.exports = router;