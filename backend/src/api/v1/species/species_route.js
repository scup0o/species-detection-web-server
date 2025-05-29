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


module.exports = router;