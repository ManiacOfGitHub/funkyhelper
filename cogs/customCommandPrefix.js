const { EmbedBuilder } = require("discord.js");
var util = require("../util");
var db, getCmdNodeIdFromName, getConsoleNodes, getConsoleNamesForConsole, getTextData, getEmbedData, searchDataNode;

module.exports = (client, logChannels, config, botContext) => {
    async function onReady() {
        db = botContext.db;

        await botContext.customCommandCogLoaded;
        searchDataNode = botContext.customCommandCog.searchDataNode;
        getConsoleNodes = botContext.customCommandCog.getConsoleNodes;
        getConsoleNamesForConsole = botContext.customCommandCog.getConsoleNamesForConsole;
        getCmdNodeIdFromName = botContext.customCommandCog.getCmdNodeIdFromName;
        getTextData = botContext.customCommandCog.getTextData;
        getEmbedData = botContext.customCommandCog.getEmbedData;
    }

    async function onMessage(message) {
        if(!message.content.startsWith(".")) return;
        let args = message.content.split(" ");
        let commandName = args[0].slice(1).toLowerCase();
        var result = getCmdNodeIdFromName.get(commandName);
        if(!result) return;
        var cmdNodeId = result.parent_id;
        if(!cmdNodeId) return;
        // Check for text and embeds directly underneath
        var dataNodeInfo = searchDataNode(cmdNodeId);
        if(!dataNodeInfo) {
            // Search for consoles
            var consoleNodeIds = getConsoleNodes.all(cmdNodeId).map(o=>o.id);
            if(!consoleNodeIds || !consoleNodeIds.length) return;
            var consoleNodeNames = {};
            var chosenConsoleNodeId;
            for(var consoleNodeId of consoleNodeIds) {
                consoleNodeNames[consoleNodeId] = getConsoleNamesForConsole.all(consoleNodeId).map(o=>o.name);
            }
            if(args.length && args.length > 1) {
                let consoleArg = args[1].toLowerCase();
                for(let aliases in config.consoleAliases) {
                    if(config.consoleAliases[aliases].includes(consoleArg)) {
                        consoleArg = aliases;
                        break;
                    }
                }
                for(let consoleNodeId in consoleNodeNames) {
                    if(consoleNodeNames[consoleNodeId].includes(consoleArg)) {
                        chosenConsoleNodeId = consoleNodeId;
                        break;
                    }
                }
            } else if(config.consoleHelpChannels.hasOwnProperty(message.channel.id)) {
                let consoleName = config.consoleHelpChannels[message.channel.id];
                for(let consoleNodeId in consoleNodeNames) {
                    if(consoleNodeNames[consoleNodeId].includes(consoleName)) {
                        chosenConsoleNodeId = consoleNodeId;
                        break;
                    }
                }
            }
            if(!chosenConsoleNodeId) {
                await message.reply("Please specify a parameter. Valid options are: " + Object.values(consoleNodeNames).flat().sort().join(", ") + ".");
                return;
            }
            dataNodeInfo = searchDataNode(chosenConsoleNodeId);
            if(!dataNodeInfo) return;
        }

        if(dataNodeInfo.type == 'text') {
            var textNodeData = getTextData.get(dataNodeInfo.id);
            if(!textNodeData || !textNodeData.content) return;
            if (message.reference) {
                (await message.fetchReference()).reply(textNodeData.content);
            } else {
                await message.channel.send(textNodeData.content);
            }
        } else if(dataNodeInfo.type == 'embed') {
            let embedNodeData = getEmbedData.get(dataNodeInfo.id);
            if(!embedNodeData || (!embedNodeData.title && !embedNodeData.description)) return;
            let embed = new EmbedBuilder();
            if (embedNodeData.author) embed.setAuthor({ name: embedNodeData.author });
            if (embedNodeData.title) embed.setTitle(embedNodeData.title);
            if (embedNodeData.color) {
                var consoleColors = {
                    "3DS": 0xCE181E,
                    "WiiU": 0x009AC7,
                    "Switch": 0xE60012,
                    "Wii": 0x009AC7
                }
                if (embedNodeData.color in consoleColors) {
                    embed.setColor(consoleColors[embedNodeData.color]);
                } else {
                    embed.setColor(parseInt(embedNodeData.color, 16));
                }
            };
            if (embedNodeData.image) embed.setImage(embedNodeData.image);
            if (embedNodeData.description) embed.setDescription(embedNodeData.description);
            if (embedNodeData.footer) embed.setFooter({ text: embedNodeData.footer });
            if (embedNodeData.url) embed.setURL(embedNodeData.url);
            if (message.reference) {
                (await message.fetchReference()).reply({ embeds: [embed] });
            } else {
                await message.channel.send({ embeds: [embed] });
            }
        };

    }

    return {
        onReady,
        onMessage,
        noAwait: true
    }
}