const express = require('express');
const router = express.Router();
const runCommand = require("../config/command");


router.get('/', (req, res) => {
    runCommand("alpaca account get", res);
});


module.exports = router;