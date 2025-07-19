const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const commandsDir = path.join(__dirname, 'commands');

client.on("messageCreate", async (message) => {
	if (!message.guild || message.author.bot) return;

	let args = message.content.split(" ");
    let commandName = args[0] ? args[0].slice(1) : "";
	await processWikiCommands(message);

	if (message.content.split(" ")[0] === ".create") {
        let commandName = args[1];
		if (!message.member.roles.cache.some(role => role.name === "Staff")) {
			return message.reply("You do not have permission to create commands.");
		}
		if (args.length < 3) {
			return message.reply("Not enough arguments. Usage: `.create <command name> <command content>`");
		}
		if (["create", "delete", "help", "."].includes(commandName) || (commandName.startsWith(".") || commandName === "")) {
			return message.reply("You can't create a command with that name.");
		}
        const filePath = path.join(commandsDir, `${commandName}.botcmd`);
        if (!filePath.startsWith(commandsDir)) {
            return message.reply("Invalid command path.");
        }
		const commandContent = args.slice(2).join(" ");
		fs.writeFile(`./commands/${commandName}.botcmd`, commandContent, (err) => {
			if (err) return message.reply("Error saving command.");
			message.reply(`Command \`.${commandName}\` created!`);
		});
	}

	if (message.content.split(" ")[0] === ".delete") {
        let commandName = args[1];
		if (!message.member.roles.cache.some(role => role.name === "Staff")) {
			return message.reply("You do not have permission to delete commands.");
		}
		if (args.length < 2) {
			return message.reply("Not enough arguments. Usage: `.delete <command name>`");
		}
        commandName = path.basename(commandName);
        const filePath = path.join(commandsDir, `${commandName}.botcmd`);
        if (!filePath.startsWith(commandsDir)) {
            return message.reply("Invalid command path.");
        }
		fs.unlink(`./commands/${commandName}.botcmd`, (err) => {
			if (err) return message.reply(`Command ${commandName} does not exist.`);
			message.reply(`Command \`.${commandName}\` deleted!`);
		});
	}

	if (message.content.split(" ")[0] === ".help") {
		fs.readdir('./commands', (err, files) => {
			if (err) return message.reply("Error reading commands.");
			const commandList = files.filter(file => file.endsWith('.botcmd')).map(file => file.replace('.botcmd', '')).sort();
			message.reply("Commands: " + (commandList.length ? commandList.join(", ") : "None"));
		});
	}

	if (message.content.startsWith(".") && fs.existsSync(`./commands/${commandName}.botcmd`)) {
		fs.readFile(`./commands/${commandName}.botcmd`, 'utf8', async (err, commandContent) => {
            if (commandContent === "" || commandContent === null) {
                return message.reply("Command content is empty.");
            }
                if (err) return;
                try {
                    let data = JSON.parse(commandContent);
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
                            embed.setColor(parseInt(data.color,16));
                        }};
                    if (data.image) embed.setImage(data.image);
                    if (data.description) embed.setDescription(data.description);
                    if (data.footer) embed.setFooter({ text: data.footer });
                    if (data.url) embed.setURL(data.url);

                    if (message.reference) {
                        (await message.fetchReference()).reply({ embeds: [embed] });
                    } else {
                        message.channel.send({ embeds: [embed] });
                    }
                } catch {
                    if (message.reference) {
                        (await message.fetchReference()).reply(commandContent);
                    } else {
                        message.channel.send(commandContent);
                    }
                }
            });
	}

	if (message.content === ".test") {
		const embed = new EmbedBuilder().setDescription("This is a test message.");
		message.channel.send({ embeds: [embed] });
	}
});

client.once(Events.ClientReady, () => {
	console.log('Ready! Logged in as ' + client.user.tag);
    const commandsDir = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true });
    }
});

client.login(config.token);

async function generateWikiPage(wikiCommand) {
	if (!wikiCommand.length) return;
	wikiCommand = wikiCommand[0].toUpperCase() + wikiCommand.slice(1).replace(/ /g, "_");
	let response = await fetch(`https://wiki.hacks.guide/w/api.php?action=query&meta=siteinfo&siprop=general&iwurl=true&titles=${encodeURIComponent(wikiCommand.split("#")[0])}&format=json`).then(res => res.json());
	if (response.query?.interwiki?.[0]?.url) return `<${response.query.interwiki[0].url}>`;
	if (response.query?.normalized?.[0]?.to) wikiCommand = response.query.normalized[0].to;
	return `<https://wiki.hacks.guide/wiki/${wikiCommand}>`;
}

async function processWikiCommands(message) {
	let botMessage = "";
	let currentMessageContent = message.content;
	let numLooped = 0;

	while (currentMessageContent.includes("[[") && numLooped < 10) {
		let wikiCommandStart = currentMessageContent.split("[[").slice(1).join("[[");
		if (!wikiCommandStart.includes("]]")) return;
		let wikiCommand = wikiCommandStart.split("]]")[0];
		let wikiURL = await generateWikiPage(wikiCommand);
		if (!wikiURL) return;
		botMessage += (botMessage ? ", " : "") + wikiURL;
		currentMessageContent = wikiCommandStart.split("]]").slice(1).join("]]");
		numLooped++;
	}
	if (!botMessage) return;
	botMessage = `Link${numLooped > 1 ? "s" : ""}: ${botMessage}`;
	if (message.reference) {
		(await message.fetchReference()).reply(botMessage);
	} else {
		message.channel.send(botMessage);
	}
}
