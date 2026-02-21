var fs = require('fs');
var {EmbedBuilder} = require("discord.js");

module.exports = (client, logChannel, config) => {
    async function onCommand(commandName, args, message) {
        if (message.content.startsWith(".") && fs.existsSync(`./alias/${commandName}.alias`)) {
            try {
                commandName = fs.readFileSync(`./alias/${commandName}.alias`, 'utf8');
            } catch(err) {
                console.log(`Could not fetch alias ${commandName}`);
            }
        }
        if (message.content.startsWith(".") && fs.existsSync(`./commands/${commandName}.botcmd`)) {
            fs.readFile(`./commands/${commandName}.botcmd`, 'utf8', async (err, commandContent) => {
                if (commandContent === "" || commandContent === null) {
                    return message.reply("Command content is empty.");
                }
                if (err) return;
                await processCmdData(commandContent, message, args);
            });
        }
    }

    async function processCmdData(data, message, args) {
        try {
            if(typeof(data)=="string") {
                if (!(data.startsWith("`") && data.endsWith("`"))) {
                    throw Error();
                }
                data = JSON.parse(data.slice(1, -1));
            }
            if(data.consoles) {
                if(args.length && args.length > 1) {
                    let consoleArg = args[1];
                    for(let aliases in config.consoleAliases) {
                        if(config.consoleAliases[aliases].includes(consoleArg)) {
                            consoleArg = aliases;
                            break;
                        }
                    }
                    if(data.consoleMaps) {
                        if(data.consoleMaps.hasOwnProperty(consoleArg)) {
                            consoleArg = null; // don't allow use of console map name as console argument
                        }
                        for(let consoleMap in data.consoleMaps) {
                            if(data.consoleMaps[consoleMap].includes(consoleArg)) {
                                consoleArg = consoleMap;
                                break;
                            }
                        }
                    }
                    if(data.consoles.hasOwnProperty(consoleArg)) {
                        return processCmdData(data.consoles[consoleArg], message, args);
                    }
                }
                if(config.consoleHelpChannels.hasOwnProperty(message.channel.id)) {
                    let consoleName = config.consoleHelpChannels[message.channel.id];
                    if(data.consoleMaps) {
                        if(data.consoleMaps.hasOwnProperty(consoleName)) {
                            consoleArg = null;
                        }
                        for(let consoleMap in data.consoleMaps) {
                            if(data.consoleMaps[consoleMap].includes(consoleName)) {
                                consoleName = consoleMap;
                                break;
                            }
                        }
                    }
                    if(data.consoles.hasOwnProperty(consoleName)) {
                        return processCmdData(data.consoles[consoleName], message, args);
                    }
                }
                let options = Object.keys(data.consoles);
                if(data.consoleMaps) {
                    for(var i in options) {
                        if(data.consoleMaps[i]) {
                            options[i] = data.consoleMaps[i];
                        }
                    }
                }
                options = options.flat();
                for(var i in options) {
                    if(config.consoleAliases.hasOwnProperty(options[i])) {
                        options[i] = [options[i], ...config.consoleAliases[options[i]]];
                    }
                }
                options = options.flat();
                await message.reply("Please specify a console. Valid options are: " + options.sort().join(", ") + ".");
                return;
            }
            let embed = new EmbedBuilder();
            if (data.author) embed.setAuthor({ name: data.author });
            if (data.title) embed.setTitle(data.title);
            if (data.color) {
                var consoleColors = {
                    "3DS": 0xCE181E,
                    "WiiU": 0x009AC7,
                    "Switch": 0xE60012,
                    "Wii": 0x009AC7
                }
                if (data.color in consoleColors) {
                    embed.setColor(consoleColors[data.color]);
                } else {
                    embed.setColor(parseInt(data.color, 16));
                }
            };
            if (data.image) embed.setImage(data.image);
            if (data.description) embed.setDescription(data.description);
            if (data.footer) embed.setFooter({ text: data.footer });
            if (data.url) embed.setURL(data.url);
            if (message.reference) {
                (await message.fetchReference()).reply({ embeds: [embed] });
            } else {
                await message.channel.send({ embeds: [embed] });
            }
        } catch(err) {
            if (message.reference) {
                (await message.fetchReference()).reply(data);
            } else {
                await message.channel.send(data);
            }
        }
        
    }

    return {
        onCommand
    };
}