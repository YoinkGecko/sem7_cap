const express = require('express');
const router = express.Router();
const runCommand = require("../config/command");


router.get('/', (req, res) => {
    runCommand("alpaca account get", res);
});

router.get('/portfolio', (req, res) => {
    runCommand("alpaca account portfolio", res);
});

router.get('/activity', (req, res) => {
    runCommand("alpaca account activity list", res);
});

module.exports = router;