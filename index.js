const { Client, Events, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const util = require('./lib/util');

var config = require('./config.json');
var client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent], allowedMentions: {parse: ['users'], roles: [config.matchmakingRoleId,config.activeModeratorsId]}});
var matchmakingTimer = 0;
var logChannel;

const commandsDir = path.join(__dirname, 'commands');
const keywordsDir = path.join(__dirname, 'keywords');
const aliasDir = path.join(__dirname, "alias");

var stickyMessageLib, withdrawalScamLib, onBreakLib, customCommandLib;
var libLoaded = false;


client.on("messageCreate", async (message) => {
	if (!message.guild || message.author.bot) return;
	if(!libLoaded) return;
	await stickyMessageLib.onMessage(message);

	(async()=>{
		try {
			await withdrawalScamLib.onMessage(message);
		} catch(err) {
			console.error(err);
			await logChannel.send("An error occured with the withdrawalScam library. \nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
			await withdrawalScamLib.liftLock();
		}
	})();

	let args = message.content.split(" ");
	let commandName = (args[0] ? args[0].slice(1) : "").toLowerCase();
	await processWikiCommands(message);

	if(message.content.startsWith(".")) {
		try {
			await onBreakLib.onCommand(commandName, args, message);
		} catch(err) {
			console.error(err);
			await logChannel.send("An error occured with the onBreakLib library. \nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
	}

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
		if (["create", "delete", "help", ".", "test", "keyword", "deletekeyword", "helpkeywords", "alias", "deletealias", "helpalias", "switchpiracy", "sp", "echo", "say", "reply", "pull", "stop", "config", "onbreak", "offbreak"].includes(commandName.toLowerCase()) || (commandName.startsWith(".") || commandName === "")) {
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

	if(message.content.startsWith(".")) {
		try {
			await customCommandLib.onCommand(commandName, args, message);
		} catch(err) {
			console.error(err);
			await logChannel.send("An error occured with a custom commands. \nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
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

	if([".say",'.echo'].includes(message.content.split(" ")[0].toLowerCase())) {
		if (!message.member.roles.cache.some(role => config.breakRoleList.includes(role.id) || config.staffRoleList.includes(role.id)) && !havePermission(message.member)) {
			return message.reply("no");
		}
		if(args.length < 3) {
			await message.reply("Not enough arguments");
			return;
		}
		var channel;
		let channelId = args[1].matchAll(/\d/g).toArray().join("");
		if((!config.echoChannelIds.includes(channelId)) && !config.botOwners.includes(message.member.id)) {
			await message.reply(`You cannot \`.${commandName}\` into that channel. You can \`.${commandName}\` into: ${config.echoChannelIds.map(o=>`<#${o}>`).join(", ")}`);
			return;
		}
		if(channelId) {
			try {
				channel = await message.guild.channels.fetch(channelId);
			} catch(err) {}
		}
		if(!channel) {
			await message.reply("Valid channel was not provided.");
			return;
		}
		try {
			await channel.send(args.slice(2).join(" "));
		} catch(err) {
			console.error(err);
			await message.reply("Failed to send message (does the bot have permission to speak there?)\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
		try {
			await message.delete();
		} catch(err) {
			//I really don't care enough to do anything with this.
		}
	}

	if(message.content.split(" ")[0].toLowerCase() == ".reply") {
		if (!message.member.roles.cache.some(role => config.breakRoleList.includes(role.id) || config.staffRoleList.includes(role.id)) && !havePermission(message.member)) {
			return message.reply("no");
		}
		if(args.length < 4) {
			await message.reply("Not enough arguments");
			return;
		}
		var channel;
		let channelId = args[1].matchAll(/\d/g).toArray().join("");
		if((config.echoChannelIds.includes(channelId)) && !config.botOwners.includes(message.member.id)) {
			await message.reply(`You cannot \`.reply\` into that channel. You can \`.reply\` into: ${config.echoChannelIds.map(o=>`<#${o}>`).join(", ")}`);
			return;
		}
		if(channelId) {
			try {
				channel = await message.guild.channels.fetch(channelId);
			} catch(err) {}
		};
		if(!channel) {
			await message.reply("Valid channel was not provided.");
			return;
		};
		let messageToReplyTo;
		let messageId = args[2].matchAll(/\d/g).toArray().join("");
		if(messageId) {
			try {
				messageToReplyTo = await channel.messages.fetch(messageId);
			} catch(err) {};
		}
		if(!messageToReplyTo) {
			await message.reply("Message not found.");
			return;
		}
		try {
			await messageToReplyTo.reply(args.slice(3).join(" "), {allowedMentions:{repliedUser: false}});
		} catch(err) {
			console.error(err);
			await message.reply("Failed to send message (does the bot have permission to speak there?)\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
		try {
			await message.delete();
		} catch(err) {
			//I really don't care enough to do anything with this.
		}
	}

	if(message.content.split(" ")[0].toLowerCase() == ".matchmaking") {
		if(message.channel.id!=config.matchmakingChannelId) {
			await message.reply("This command can only be used in <#" + config.matchmakingChannelId + ">");
			return;
		}
		if(matchmakingTimer != 0) {
			var minutes = Math.floor(matchmakingTimer/60);
			var seconds = matchmakingTimer % 60;
			await message.reply("This command is on cooldown. Wait " + (minutes ? minutes.toString() + " minute" + (minutes!=1 ? "s" : "") + " and " : "") + (seconds.toString() + " second" + (seconds!=1 ? "s" : "")) + " before sending again");
		} else {
			matchmakingTimer = 60 * 10;
			await message.channel.send("<@&"+config.matchmakingRoleId+">");
		}
	}

	if([".switchpiracy",".sp"].includes(message.content.split(" ")[0].toLowerCase())) {
		if (!message.member.roles.cache.some(role => config.helperPlusRoleList.includes(role.id))) {
			return message.reply("no");
		}
		var theDumbass = message.mentions.members.first();
		if(!theDumbass) {
			return message.reply("No user provided");
		}
		try {
			var switchPiracyRole = await message.guild.roles.fetch(config.switchPiracyRoleId);
		} catch(err) {
			if(err.message) logChannel.send(err.message);
			return message.reply("Failed to get the Switch Piracy Watchlist role.");
		}

		try {
			var switchPiracyAppealedRole = await message.guild.roles.fetch(config.switchPiracyAppealedRoleId);
		} catch(err) {
			if(err.message) logChannel.send(err.message);
			return message.reply("Failed to get the Switch Piracy Appealed role.");
		}
		let fulldelPhrases = ["fulldelete", "fullremove", "fulldel"];
		let delPhrases = ["delete","remove","del",...fulldelPhrases];
		var removeMode = args.length > 1 && delPhrases.includes(args[1].toLowerCase());
		var fullRemoveMode = args.length > 1 && fulldelPhrases.includes(args[1].toLowerCase());
		try {
			if(removeMode) {
				await theDumbass.roles.remove(switchPiracyRole, "Removed by FunkyHelper");	
			} else {
				await theDumbass.roles.add(switchPiracyRole, "Added by FunkyHelper");
			}
		} catch(err) {
			if(err.message) logChannel.send(err.message);
			return message.reply(`Failed to ${removeMode?"remove role from":"add role to"} user. (Switch Piracy Watchlist)`);
		}
		if(removeMode) {
			try {
				if(fullRemoveMode) {
					await theDumbass.roles.remove(switchPiracyAppealedRole, "Removed by FunkyHelper")
				} else {
					await theDumbass.roles.add(switchPiracyAppealedRole, "Added by FunkyHelper")
				}
			} catch(err) {
				if(err.message) logChannel.send(err.message);
				return message.reply(`Failed to ${fullRemoveMode?"remove role from":"add role to"} user. (Switch Piracy Appealed)`);
			}
		}
		let replyMsg = `${theDumbass.toString()} has been ${removeMode?"**removed from**":"**added to**"} the Switch Piracy Watchlist.`;
		if(removeMode) {
			replyMsg += ` They now ${fullRemoveMode ? "**do not have**" : "**have**"} the Switch Piracy Appealed role.`;
		} else {
			if(theDumbass.roles.cache.some(role => config.switchPiracyAppealedRoleId.includes(role.id))) {
				replyMsg += "\n**Notice!** This user is a repeat offender. This is usually grounds for a ban.";
			}
		}
		return message.reply(replyMsg);
	}

	if(message.content.split(" ")[0].toLowerCase() == ".pull") {
		if (!config.botOwners.includes(message.member.id)) {
			return message.reply("You do not have permission to pull from the repo. (You must be part of the `botOwners` list)");
		}
		exec("git pull", async(err, stdout)=>{
			if(err) {
				console.error(err);
				return message.reply("Git pull failed somehow. Idk");
			}
			if(stdout) {
				await message.reply(stdout);
			}
			await message.reply("Bot is now restarting... (unless you don't have monit lol)");
			exec("monit restart funkyhelper");
		});
	}

	if(message.content.split(" ")[0].toLowerCase() == ".stop") {
		if (!havePermission(message.member)) {
			return message.reply("You do not have permission to restart the bot.");
		}
		await message.reply("Bot is now restarting... (unless you don't have monit lol)");
		exec("monit restart funkyhelper");
	}

	if(message.content.split(" ")[0].toLowerCase() == ".config") {
		if (!config.botOwners.includes(message.member.id)) {
			return message.reply("You do not have permission to edit the configuration. (You must be part of the `botOwners` list)");
		}

		let content = args.slice(1).join(" ");
		if(!content.startsWith("`") || !content.endsWith("`")) {
			return message.reply("You must surround JSON with backticks (`)");
		}
		content = content.slice(1,-1);
		try {
			content = JSON.parse(content);
		} catch(err) {
			return message.reply("Failed to parse as JSON.");
		}
		for(let i in content) {
			config[i] = content[i];
		}
		 
		try {
			fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
		} catch(err) {
			return message.reply("Failed to save config to file.");
		}

		return message.reply("Updated config! In some cases, you may need to restart the bot for the changes to apply.");
	}
});

client.on("messageDelete", async (message) => {
	if (message.author.bot) return;
	if (message.attachments.size > 0) {
		var logChannel = await client.channels.fetch(config.logChannelId);
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

client.once(Events.ClientReady, async() => {
	console.log('Ready! Logged in as ' + client.user.tag);
	client.user.setPresence({
		activities: [{
			name: "Stay Funky and Happy Modding!",
			type: ActivityType.Playing
		}],
		status: "online"
	});

	try {
		logChannel = await client.channels.fetch(config.logChannelId);
		let embed = new EmbedBuilder();
		embed.setTitle("FunkyHelper is online!");
		embed.setDescription("The bot has just started. If this happens several times within a few minutes, the bot may be crashing. Please notify a Bot Maintainer if so.");
		embed.setColor("Aqua");
		await logChannel.send({embeds:[embed]});
	} catch(err) {
		console.log("Failed to send startup message.\n"+err);
	}
	const commandsDir = path.join(__dirname, 'commands');
	if (!fs.existsSync(commandsDir)) {
		fs.mkdirSync(commandsDir, { recursive: true });
	}
	const keywordsDir = path.join(__dirname, 'keywords');
	if (!fs.existsSync(keywordsDir)) {
		fs.mkdirSync(keywordsDir, { recursive: true });
	}
	const aliasDir = path.join(__dirname, 'alias');
	if (!fs.existsSync(aliasDir)) {
		fs.mkdirSync(aliasDir, { recursive: true });
	}

	stickyMessageLib = (require("./lib/stickyMessages"))(client, logChannel, config);
	await stickyMessageLib.onReady();

	withdrawalScamLib = (require("./lib/withdrawalScam"))(client, logChannel, config);
	await withdrawalScamLib.onReady();

	onBreakLib = (require("./lib/onBreak"))(client, logChannel, config);

	customCommandLib = (require("./lib/customCommand"))(client, logChannel, config);

	libLoaded = true;

	setInterval(processTimers, 1000);
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


async function processTimers() {
	await stickyMessageLib.processTimers();
	if(matchmakingTimer > 0) {
		matchmakingTimer--;
	}
}