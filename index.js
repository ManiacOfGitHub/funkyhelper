var { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
var config = require('./config.json');
var fs = require('fs');

var client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on("messageCreate", async(message) => {
    if(message.author.bot) {
        return;
    }
    await processWikiCommands(message);
    if(message.content.startsWith(".create")) {
        if(!message.member.roles.cache.some(role => role.name === "Staff")) {
            message.reply("You do not have permission to create commands.");
            return;
        }
        if(!(message.content.split(" ").length > 2)) {
            message.reply("Not enough arguments. Usage: `.create <command name> <command content>`");
            return;
        }
        var commandName = message.content.split(" ")[1];
        if(commandName == "create" || commandName == "delete" || commandName == "help") {
            message.reply(":frowning:");
            return;
        }
        var commandContent = message.content.split(" ").slice(2).join(" ");
        fs.writeFileSync(`./commands/${commandName}.botcmd`, commandContent);
        message.reply(`Command \`.${commandName}\` created!`);
    }
    if(message.content.startsWith(".delete")) {
        if(!message.member.roles.cache.some(role => role.name === "Staff")) {
            message.reply("You do not have permission to delete commands.");
            return;
        }
        if(!(message.content.split(" ").length > 1)) {
            message.reply("Not enough arguments. Usage: `.delete <command name>`");
            return;
        }
        var commandName = message.content.split(" ")[1];
        if(fs.existsSync(`./commands/${commandName}.botcmd`)) {
            fs.unlinkSync(`./commands/${commandName}.botcmd`);
            message.reply(`Command \`.${commandName}\` deleted!`);
        } else {
            message.reply(`Command ${commandName} does not exist.`);
        }
    }
    if(message.content.startsWith(".help")) {
        var helpMessage = "Commands: ";
        var commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.botcmd'));
        commandFiles = commandFiles.sort();
        for(const file of commandFiles) {
            helpMessage += (helpMessage == "Commands: " ? "" : ", ") + file.split(".")[0];
        }
        message.reply(helpMessage);
    }
    if(message.content.startsWith(".") && fs.existsSync(`./commands/${message.content.split(" ")[0].slice(1)}.botcmd`)) {
        var commandContent = fs.readFileSync(`./commands/${message.content.split(" ")[0].slice(1)}.botcmd`, 'utf8');
        var embed = new EmbedBuilder();
        try {
            var data = JSON.parse(commandContent);
            if(data.author) {
                embed.setAuthor({name:data.author});
            }
            if(data.title) {
                embed.setTitle(data.title);
            }
            if(data.color) {
                var consoleColors = {
                    "3DS": 0xCE181E,
                    "WiiU": 0x009AC7,
                    "Switch": 0xE60012,
                    "Wii": 0x009AC7
                }
                if(data.color in consoleColors) {
                    embed.setColor(consoleColors[data.color]);
                } else {
                    embed.setColor(parseInt(data.color,16));
                }
            }
            if(data.image) {
                embed.setImage(data.image);
            }
            if(data.description) {
                embed.setDescription(data.description);
            }
            if(data.footer) {
                embed.setFooter({text:data.footer});
            }
            if(data.url) {
                embed.setURL(data.url);
            }
        } catch(e) {
            embed.setDescription(commandContent);
        }
        try {
            if(message.reference) {
                await (await message.fetchReference()).reply({embeds:[embed]});
            } else {
                await message.channel.send({embeds:[embed]});
            }
        } catch(e) {
            var embed = new EmbedBuilder();
            embed.setDescription(commandContent);
            if(message.reference) {
                await (await message.fetchReference()).reply({embeds:[embed]});
            } else {
                await message.channel.send({embeds:[embed]});
            }
        }
    }
    if(message.content==".test") {
        var embed = new EmbedBuilder();
        embed.setDescription("This is a test message.");
        message.channel.send({embeds:[embed]});
    }
});


client.once(Events.ClientReady, () => {
    console.log('Ready! Logged in as ' + client.user.tag);
});

client.login(config.token);

async function generateWikiPage(wikiCommand) {
    if(wikiCommand.length==0) return;
    wikiCommand = wikiCommand[0].toUpperCase() + wikiCommand.slice(1);
    var response = await (await fetch(`https://wiki.hacks.guide/w/api.php?action=query&meta=siteinfo&siprop=general&iwurl=true&titles=${encodeURI(wikiCommand.split("#")[0])}&format=json`)).json();
    if(response.query&&response.query.interwiki) {
        wikiCommand = response.query.interwiki[0].url;
    }
    if(response.query&&response.query.normalized) {
        wikiCommand = response.query.normalized[0].to;
    }
    wikiCommand = wikiCommand.replaceAll(" ", "_");
    if(wikiCommand.startsWith("http")) {
        return "<" + wikiCommand + ">";
    }
    return `<https://wiki.hacks.guide/wiki/${wikiCommand}>`;
}

async function processWikiCommands(message) {
    var botMessage = "";
    var currentMessageContent = message.content;
    var numLooped = 0;
    while(currentMessageContent.includes("[[") && numLooped < 10) {
        var wikiCommandStart = currentMessageContent.split("[[").slice(1).join("[[");
        if(!wikiCommandStart.includes("]]")) {
            return;
        }
        var wikiCommand = wikiCommandStart.split("]]")[0];
        var wikiURL = await generateWikiPage(wikiCommand);
        if(!wikiURL) {
            return;
        }
        botMessage += (botMessage == "" ? "" : ", ") + wikiURL;
        currentMessageContent = wikiCommandStart.split("]]").slice(1).join("]]");
        numLooped++;
    }
    if(!botMessage) {
        return;
    }
    botMessage = "Link" + (numLooped > 1 ? "s" : "") + ": " + botMessage;
    if(message.reference) {
        (await message.fetchReference()).reply(botMessage);
    } else {
        message.channel.send(botMessage);
    }
}