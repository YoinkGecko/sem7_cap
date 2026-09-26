const express = require('express');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// Helper function to run shell commands
const runCommand = (command, res) => {
    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).send(`Error: ${error.message}`);
        }
        if (stderr) {
            return res.status(500).send(`Stderr: ${stderr}`);
        }
        // Send output back wrapped in <pre> tags for clean terminal-like formatting in the browser
        res.send(`<pre>${stdout}</pre>`);
    });
};

// Route for /ls
app.get('/ls', (req, res) => {
    runCommand('ls -la', res); 
});

// Route for /pwd
app.get('/pwd', (req, res) => {
    runCommand('pwd', res);
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});