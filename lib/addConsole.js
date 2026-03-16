var fs = require('fs');

module.exports = (client, logChannel, config, havePermission) => {
    async function onCommand(command, args, message) {
        if(!(["addconsole", "removeconsole", "delconsole"].includes(command))) return;
        if(!havePermission(message.member)) {
            await message.reply("You do not have permission to edit commands.");
            return;
        }
        if(args.length < (command=="addconsole"?4:3)) {
            await message.reply("Not enough arguments.");
            return;
        }
        let commandName = args[1];
        if(!fs.existsSync(`./commands/${commandName}.botcmd`)) {
            await message.reply("Command does not exist.");
            return;
        }
        let commandContent = fs.readFileSync(`./commands/${commandName}.botcmd`, 'utf-8');
        var isJSON = true;
        if(!commandContent.startsWith("`") || !commandContent.endsWith("`")) isJSON = false;
        try {
            var commandJSON = JSON.parse(commandContent.slice(1,-1));
        } catch(err) {
            isJSON = false;
        }
        if(!isJSON) {
            await message.reply("Command does not contain valid JSON data.");
            return;
        }
        if(!commandJSON.consoles) {
            await message.reply("Command does not contain any console parameters.");
            return;
        }

        // .addconsole
        if(command == "addconsole") {
            let newConsoleName = args[2];
            let newData = args.slice(3).join(" ");
            try {
                if(!newData.startsWith("`") || !newData.endsWith("`")) throw Error();
                var newConsoleData = JSON.parse(newData.slice(1,-1));
            } catch(err) {
                newConsoleData = newData;
            }
            commandJSON.consoles[newConsoleName] = newConsoleData;
            fs.writeFileSync(`./commands/${commandName}.botcmd`, `\`${JSON.stringify(commandJSON)}\``);
            await message.reply(`New console \`${newConsoleName}\` parameter added/edited for .${commandName}!`);
            return;
        }
        
        // .removeconsole
        if(["removeconsole","delconsole"].includes(command)) {
            let consoleName = args[2];
            if(!commandJSON.consoles.hasOwnProperty(consoleName)) {
                await message.reply(`Command does not contain a \`${consoleName}\` console parameter.`);
                return;
            }
            delete commandJSON.consoles[consoleName];
            fs.writeFileSync(`./commands/${commandName}.botcmd`, `\`${JSON.stringify(commandJSON)}\``);
            await message.reply(`Removed console \`${consoleName}\` parameter from .${commandName}!`);
            return;
        }
    }
    return {
        onCommand
    }
}