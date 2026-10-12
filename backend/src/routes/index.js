const express = require("express");

const v1 = require("./v1");
const v2 = require("./v2");

/**
 * API versions are mounted here and nowhere else, so `app.js` does not need to
 * know how many exist.
 *
 * The unprefixed mount keeps the original `/api/<resource>` URLs working and
 * points them at v1. Those paths shipped before versioning existed, and
 * breaking them to tidy up the routing table would be a poor trade. New clients
 * should call `/api/v1` or `/api/v2` explicitly.
 */
const router = express.Router();

router.use("/v1", v1);
router.use("/v2", v2);

// Legacy, unversioned: an alias for v1.
router.use("/", v1);

module.exports = router;
