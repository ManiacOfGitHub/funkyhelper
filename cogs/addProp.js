var fs = require('fs');
var objectPath = require("object-path");

module.exports = (client, logChannels, config, clientState) => {
    async function onCommand(command, args, message) {
        if(!(["addprop", "removeprop", "delprop"].includes(command))) return;
        if(!clientState.havePermission(message.member)) {
            await message.reply("You do not have permission to edit commands.");
            return;
        }
        if(args.length < (command=="addprop"?4:3)) {
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
        let propPath = args[2];

        // .addprop
        if(command == "addprop") {
            let propValueStr = args.slice(3).join(" ");
            try {
                if(!propValueStr.startsWith("`") || !propValueStr.endsWith("`")) throw Error();
                var propValue = JSON.parse(propValueStr.slice(1,-1));
            } catch(err) {
                await message.reply("Invalid JSON data provided.");
                return;
            }
            objectPath.set(commandJSON, propPath, propValue);
            fs.writeFileSync(`./commands/${commandName}.botcmd`, `\`${JSON.stringify(commandJSON)}\``);
            await message.reply("Property added!");
            return;
        }

        // .removeprop
        if(["removeprop","delprop"].includes(command)) {
            if(!objectPath.has(commandJSON, propPath)) {
                await message.reply(`\`.${commandName}\` has no property \`${propPath}\`!`);
                return;
            }
            objectPath.del(commandJSON, propPath);
            fs.writeFileSync(`./commands/${commandName}.botcmd`, `\`${JSON.stringify(commandJSON)}\``);
            await message.reply("Property removed!");
            return;
        }
    }
    return {
        onCommand
    }
}