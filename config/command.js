const { exec } = require('child_process');

const runCommand = (command, res) => {
    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).send(`Error: ${error.message}`);
        }
        if (stderr) {
            return res.status(500).send(`Stderr: ${stderr}`);
        }
        res.send(`<pre>${stdout}</pre>`);
    });
};

module.exports = runCommand;