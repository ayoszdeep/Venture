const express = require("express");

const { listPrograms } = require("../../controllers/v2/programController");

const router = express.Router();

router.get("/", listPrograms);

module.exports = router;
