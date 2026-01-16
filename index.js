const { Client, Events, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });
const commandsDir = path.join(__dirname, 'commands');
const keywordsDir = path.join(__dirname, 'keywords');
const aliasDir = path.join(__dirname, "alias");

client.on("messageCreate", async (message) => {
	if (!message.guild || message.author.bot) return;

	let args = message.content.split(" ");
	let commandName = args[0] ? args[0].slice(1) : "";
	await processWikiCommands(message);

	// Alias create command
	if (message.content.split(" ")[0] === ".alias") {
		if (!havePermission(message.member)) {
			return message.reply("You do not have permission to create aliases.");
		}
		if (args.length < 3) {
			return message.reply("Not enough arguments. Usage: `.alias <ogcommand> <alias>`");
		}
		let aliasName = args[2].toLowerCase();
		if (aliasName === "" || aliasName.startsWith(".")) {
			return message.reply("You can't create a alias with that name.");
		}
		const filePath = path.join(aliasDir, `${aliasName}.alias`);
		if (!filePath.startsWith(aliasDir)) {
			return message.reply("Invalid alias path.");
		}
		const ogCommand = args[1].toLowerCase();
		fs.writeFile(filePath, ogCommand, (err) => {
			if (err) return message.reply("Error saving alias.");
			message.reply(`Alias \`${aliasName}\` for \`${ogCommand}\` created!`);
		});
		return;
	}

	// Alias delete command
	if (message.content.split(" ")[0] === ".deletealias") {
		if (!havePermission(message.member)) {
			return message.reply("You do not have permission to delete aliases.");
		}
		if (args.length < 2) {
			return message.reply("Not enough arguments. Usage: `.deletealias <alias>`");
		}
		let aliasName = path.basename(args[1]).toLowerCase();
		const filePath = path.join(aliasDir, `${aliasName}.alias`);
		if (!filePath.startsWith(aliasDir)) {
			return message.reply("Invalid alias path.");
		}
		fs.unlink(filePath, (err) => {
			if (err) return message.reply(`Alias \`${aliasName}\` does not exist.`);
			message.reply(`Alias \`${aliasName}\` deleted!`);
		});
		return;
	}

	// Alias help command
	if (message.content.split(" ")[0] === ".helpalias") {
		fs.readdir('./alias', (err, files) => {
			if (err) return message.reply("Error reading aliases.");
			const aliasList = files.filter(file => file.endsWith('.alias')).map(file => file.replace('.alias', '')).sort();
			message.reply("Aliases: " + (aliasList.length ? aliasList.join(", ") : "None"));
		});
		return;
	}

	if (message.content.split(" ")[0] === ".create") {
		let commandName = args[1];
		if (!havePermission(message.member)) {
			return message.reply("You do not have permission to create commands.");
		}
		if (args.length < 3) {
			return message.reply("Not enough arguments. Usage: `.create <command name> <command content>`");
		}
		if (["create", "delete", "help", ".", "test", "keyword", "deletekeyword", "helpkeywords"].includes(commandName.toLowerCase()) || (commandName.startsWith(".") || commandName === "")) {
			return message.reply("You can't create a command with that name.");
		}
		commandName = commandName.toLowerCase();
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
		if (!havePermission(message.member)) {
			return message.reply("You do not have permission to delete commands.");
		}
		if (args.length < 2) {
			return message.reply("Not enough arguments. Usage: `.delete <command name>`");
		}
		commandName = path.basename(commandName).toLowerCase();
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

	commandName = commandName.toLowerCase();
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
			try {
				if (!(commandContent.startsWith("`") && commandContent.endsWith("`"))) {
					throw Error();
				}
				let data = JSON.parse(commandContent.slice(1, -1));
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

	// Keyword create command
	if (message.content.split(" ")[0] === ".keyword") {
		if (!havePermission(message.member)) {
			return message.reply("You do not have permission to create keywords.");
		}
		if (args.length < 3) {
			return message.reply("Not enough arguments. Usage: `.keyword <keyword> <response>`");
		}
		let keywordName = args[1].toLowerCase();
		if (keywordName === "" || keywordName.startsWith(".")) {
			return message.reply("You can't create a keyword with that name.");
		}
		const filePath = path.join(keywordsDir, `${keywordName}.botkw`);
		if (!filePath.startsWith(keywordsDir)) {
			return message.reply("Invalid keyword path.");
		}
		const keywordContent = args.slice(2).join(" ");
		fs.writeFile(filePath, keywordContent, (err) => {
			if (err) return message.reply("Error saving keyword.");
			message.reply(`Keyword \`${keywordName}\` created!`);
		});
		return;
	}

	// Keyword delete command
	if (message.content.split(" ")[0] === ".deletekeyword") {
		if (!havePermission(message.member)) {
			return message.reply("You do not have permission to delete keywords.");
		}
		if (args.length < 2) {
			return message.reply("Not enough arguments. Usage: `.deletekeyword <keyword>`");
		}
		let keywordName = path.basename(args[1]).toLowerCase();
		const filePath = path.join(keywordsDir, `${keywordName}.botkw`);
		if (!filePath.startsWith(keywordsDir)) {
			return message.reply("Invalid keyword path.");
		}
		fs.unlink(filePath, (err) => {
			if (err) return message.reply(`Keyword \`${keywordName}\` does not exist.`);
			message.reply(`Keyword \`${keywordName}\` deleted!`);
		});
		return;
	}

	// Keyword help command
	if (message.content.split(" ")[0] === ".helpkeywords") {
		fs.readdir('./keywords', (err, files) => {
			if (err) return message.reply("Error reading keywords.");
			const keywordList = files.filter(file => file.endsWith('.botkw')).map(file => file.replace('.botkw', '')).sort();
			message.reply("Keywords: " + (keywordList.length ? keywordList.join(", ") : "None"));
		});
		return;
	}
	

	// Check for keyword matches in the message
	await processKeywords(message);
});

client.on("messageDelete", async (message) => {
	if (message.author.bot) return;
	if (message.attachments.size > 0) {
		var logChannel = await client.channels.fetch("1461160220880408778");
		var messageText = `A message from ${message.author} has been deleted in ${message.channel} with ${message.attachments.size} attachment${message.attachments.size > 1 ? "s" : ""}.`;
		let files = [];
		if (message.attachments && message.attachments.values) {
			for (var attachment of message.attachments.values()) {
				if (!attachment.url) continue;
				if (attachment.size <= 10 * (10 ** 6)) {
					try {
						let file = await fetch(attachment.url);
						let fileData = Buffer.from(await file.arrayBuffer());
						files.push(new AttachmentBuilder(fileData, { name: attachment.name }));
						continue;
					} catch (err) { }
				}
				messageText += `\n<@&${config.activeModeratorsId}> ` + attachment.url + " (This file could not be permanently downloaded. This link may stop functioning at some point.)";
			}
		} else {
			messageText += "\nCould not save the attachments."
		}
		await logChannel.send({ content: messageText, flags: [4096], files });
	}
});

client.once(Events.ClientReady, () => {
	console.log('Ready! Logged in as ' + client.user.tag);
	const commandsDir = path.join(__dirname, 'commands');
	if (!fs.existsSync(commandsDir)) {
		fs.mkdirSync(commandsDir, { recursive: true });
	}
	const keywordsDir = path.join(__dirname, 'keywords');
	if (!fs.existsSync(keywordsDir)) {
		fs.mkdirSync(keywordsDir, { recursive: true });
	}
});

client.login(config.token);

function havePermission(member) {
	return member.roles.cache.some(role => config.allowRoleList.includes(role.id));
}

async function generateWikiPage(wikiCommand) {
	if (!wikiCommand.length) return;
	wikiCommand = wikiCommand[0].toUpperCase() + wikiCommand.slice(1).replace(/ /g, "_");
	let response = await fetch(`https://wiki.hacks.guide/w/api.php?action=query&meta=siteinfo&siprop=general&iwurl=true&titles=${encodeURIComponent(wikiCommand.split("#")[0])}&format=json`).then(res => res.json());
	if (response.query?.interwiki?.[0]?.url) return `<${response.query.interwiki[0].url}>`;
	if (response.query?.normalized?.[0]?.to) wikiCommand = response.query.normalized[0].to.replace(/ /g, "_");;
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

async function processKeywords(message) {
	const keywordsPath = path.join(__dirname, 'keywords');
	if (!fs.existsSync(keywordsPath)) return;

	const files = fs.readdirSync(keywordsPath).filter(file => file.endsWith('.botkw'));
	const messageContent = message.content.toLowerCase();

	for (const file of files) {
		const keyword = file.replace('.botkw', '');
		// Check if keyword appears in message (case-insensitive)
		if (messageContent.includes(keyword)) {
			const keywordContent = fs.readFileSync(path.join(keywordsPath, file), 'utf8');
			if (!keywordContent || keywordContent === "") continue;

			try {
				if (!(keywordContent.startsWith("`") && keywordContent.endsWith("`"))) {
					throw Error();
				}
				let data = JSON.parse(keywordContent.slice(1, -1));
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
					message.reply({ embeds: [embed] });
				}
			} catch {
				if (message.reference) {
					(await message.fetchReference()).reply(keywordContent);
				} else {
					message.reply(keywordContent);
				}
			}
			return; // Only respond to the first matching keyword
		}
	}
}
