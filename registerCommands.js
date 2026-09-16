var {REST, Routes} = require('discord.js');
var config = require('./config.json');
var path = require('path');
var fs = require('fs');
var cogs = [];
var commands = [];

console.log("Loading cogs...")
fs.readdirSync(path.join(__dirname, 'cogs')).forEach(file=>{
    if(file.endsWith(".js")) {
        var cogName = path.basename(file, '.js');
        cogs[cogName] = (require(path.join(__dirname, 'cogs', cogName)))();
    }
});

for(let cogName in cogs) {
    if(cogs[cogName].hasOwnProperty('commands')) {
        console.log("Loading commands from " + cogName + " cog...");
        for(let cogCommandName in cogs[cogName].commands) {
            let cogCommand = cogs[cogName].commands[cogCommandName];
            if(cogCommand?.slash?.data) {
                commands.push(cogCommand.slash.data);
                console.log(`Found /${cogCommandName}!`);
            }
        }
    }
}

console.log("Command data has loaded! Deploying with Discord API...");

var rest = new REST().setToken(config.token);
(async()=>{
    try {
        await rest.put(Routes.applicationCommands(config.clientId), {body: commands});
    } catch(err) {
        console.log("An error occurred while deploying commands:");
        console.error(err);
        return;
    }

    console.log("All global commands were successfully deployed!");
})();