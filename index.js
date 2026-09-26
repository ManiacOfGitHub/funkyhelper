const { Client, Events, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, ActivityType, AuditLogEvent, Attachment } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const util = require('./util');
const web = require('./web');

var config = require('./config.json');
const { log } = require('console');
var msgContentIntent = config.attemptPrivilegedIntents;
var client = defineClient(config.attemptPrivilegedIntents);
var logChannels = {normal: null, important: null};

const commandsDir = path.join(__dirname, 'commands');
const aliasDir = path.join(__dirname, "alias");

var cogs = {};
var cogsLoaded = false;
var botContext = {};
var commandList = ["create", "delete", "help", ".", "alias", "deletealias", "helpalias", "upload"];

var sqlite = require('better-sqlite3');
var db = sqlite('data.db');
botContext.db = db;
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON;');


function defineClient(usePrivilegedIntents) {
	var intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildModeration];
	if(usePrivilegedIntents) {
		intents.push(GatewayIntentBits.MessageContent);
	}
	let client = new Client({ intents, allowedMentions: {parse: ['users'], roles: [config.activeModeratorsId]}});
	client.on(Events.MessageCreate, msgCreateHandler);
	client.on(Events.MessageDelete, msgDeleteHandler);
	client.on(Events.InteractionCreate, interactionCreateHandler);
	client.once(Events.ClientReady, clientReady);
	return client;
}





async function msgCreateHandler(message) {
	if (!message.guild || message.author.bot) return;
	if(!cogsLoaded) {
		if(message.content && message.content.startsWith(".")) {
			await message.reply("Please wait before sending any commands, the bot is currently restarting...");
		}
		return;
	}
	
	await cogs.stickyMessages.onMessage(message);
    if(!message.content && message.content !== "") return;
	(async()=>{
		try {
			await cogs.customCommandPrefix.onMessage(message);
		} catch(err) {
			console.error(err);
			await logChannels.important.send("An error occurred with the customCommandPrefix cog. \nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
		try {
			await cogs.botTrap.onMessage(message);
		} catch(err) {
			console.error(err);
			await logChannels.important.send("An error occurred with the botTrap cog. \nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
		try {
			await cogs.withdrawalScam.onMessage(message);
		} catch(err) {
			console.error(err);
			await logChannels.important.send("An error occurred with the withdrawalScam cog. \nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
			await cogs.withdrawalScam.liftLock();
		}
		try {
			await cogs.levels.onMessage(message);
		} catch(err) {
			console.error(err);
			await logChannels.important.send("An error occurred with the levels cog.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
	})();

	let args = message.content.split(" ");
	let commandName = (args[0] ? args[0].slice(1) : "").toLowerCase();
	await processWikiCommands(message);

	if(message.content.startsWith(".")) {
		for(let cogName in cogs) {
			// Legacy Command Handler, will be removed once all cogs have been migrated.
			if(cogs[cogName].hasOwnProperty('onCommand')) {
				try {
					await cogs[cogName].onCommand(commandName, args, message);
				} catch(err) {
					console.error(err);
					await logChannels.important.send(`An error occurred with the ${cogName} cog.\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
				}
			}
			
			// New Fancy Command Handler! Yippee!
			if(cogs[cogName].hasOwnProperty('commands')) {
				for(let cogCommandName in cogs[cogName].commands) {
					let cogCommand = cogs[cogName].commands[cogCommandName]
					if(!cogCommand.hasOwnProperty('prefix') || !cogCommand.prefix.hasOwnProperty('name')) continue;
					let matchesCmd = cogCommand.prefix.name == commandName;
					if(!matchesCmd && cogCommand.prefix.hasOwnProperty('aliases')) {
						matchesCmd = Array.isArray(cogCommand.prefix.aliases) && cogCommand.prefix.aliases.includes(commandName);
					}
					if(!matchesCmd) continue;


					let cogArgs = {};
					let argIndex = 1;
					if(Array.isArray(cogCommand.prefix.params)) {
						for(var param of cogCommand.prefix.params) {
							let initialValue;
							switch(param.type) {
								case "text":
									initialValue = args[argIndex];
									argIndex++;
									break;
								case "longtext":
									initialValue = args.slice(argIndex).join(" ");
									argIndex++; // I would imagine putting any argument after a longtext argument would be strange, but why not?
									break;
								case "user":
									try {
										initialValue = await client.users.fetch(args[argIndex].match(/\d+/).join(""));
									} catch(err) {
										if(!param.optional) {
											await message.reply("Valid user was not provided.");
											return;
										}
									}
									argIndex++;
									break;
								case "member":
									try {
										initialValue = await botContext.guild.members.fetch(args[argIndex].match(/\d+/).join(""));
									} catch(err) {
										if(!param.optional) {
											await message.reply("Valid member was not provided.");
											return;
										}
									}
									argIndex++;
									break;
								default:
									throw new Error("Invalid parameter type");
							}
							if((initialValue===undefined || initialValue === "") && !param.optional) {
								await message.reply("Not enough arguments.");
								return;
							}
							let processedValue;
							if(param.process) {
								processedValue = await param.process(initialValue);
							} else {
								processedValue = initialValue;
							}
							cogArgs[param.name] = processedValue;
						}
					}


					if(!cogCommand.hasOwnProperty('handler')) {
						await message.reply(`Error: \`.${commandName}\` has no command handler!`);
						continue;
					}
					try {
						await cogCommand.handler(false, cogArgs, message, commandName);
					} catch(err) {
						console.error(err);
						await logChannels.important.send(`An error occurred with the ${cogName} cog.\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
						await message.reply(`An unhandled exception occurred when executing the command. It has been logged in a staff-only channel. Please contact a Bot Maintainer for more information.`);
					}
				}
			}
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
		fs.writeFile(filePath, ogCommand, async(err) => {
			if (err) return message.reply("Error saving alias.");
			await message.reply(`Alias \`${aliasName}\` for \`${ogCommand}\` created!`);
			await logChannels.important.send({content:`Alias \`.${aliasName}\` for \`.${ogCommand}\` created by ${message.member}`,allowedMentions:{parse:[]}});
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
		fs.unlink(filePath, async(err) => {
			if (err) return message.reply(`Alias \`${aliasName}\` does not exist.`);
			await message.reply(`Alias \`${aliasName}\` deleted!`);
			await logChannels.important.send({content:`Alias \`.${aliasName}\` deleted by ${message.member}`,allowedMentions:{parse:[]}});
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
		if (commandList.includes(commandName.toLowerCase()) || (commandName.startsWith(".") || commandName === "")) {
			return message.reply("You can't create a command with that name.");
		}
		commandName = commandName.toLowerCase();
		const filePath = path.join(commandsDir, `${commandName}.botcmd`);
		if (!filePath.startsWith(commandsDir)) {
			return message.reply("Invalid command path.");
		}
		const commandContent = args.slice(2).join(" ");
		fs.writeFile(`./commands/${commandName}.botcmd`, commandContent, async(err) => {
			if (err) return message.reply("Error saving command.");
			await message.reply(`Command \`.${commandName}\` created!`);
			await logChannels.important.send({content:`Command \`.${commandName}\` created by ${message.member}`,allowedMentions:{parse:[]}, files: [new AttachmentBuilder(`./commands/${commandName}.botcmd`)]});
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
		fs.unlink(`./commands/${commandName}.botcmd`, async(err) => {
			if (err) return message.reply(`Command ${commandName} does not exist.`);
			await message.reply(`Command \`.${commandName}\` deleted!`);
			await logChannels.important.send({content:`Command \`.${commandName}\` deleted by ${message.member}`,allowedMentions:{parse:[]}});
		});
	}

	if (message.content.split(" ")[0] === ".help") {
		fs.readdir('./commands', (err, files) => {
			if (err) return message.reply("Error reading commands.");
			const commandList = files.filter(file => file.endsWith('.botcmd')).map(file => file.replace('.botcmd', '')).sort();
			message.reply("Commands: " + (commandList.length ? commandList.join(", ") : "None"));
		});
	}

	if(message.content.split(" ")[0].toLowerCase() == ".upload") {
		if(!havePermission(message.member)) {
			return message.reply("You do not have permission to upload commands to the bot.");
		}
		if(message.attachments.size < 1) {
			return message.reply("You must provide at least one file to upload.");
		}
		if(message.attachments && message.attachments.values) {
			for(var attachment of message.attachments.values()) {
				if(!attachment.url) {
					await message.reply("Unable to get URL of " + attachment.name + ".");
					continue;
				}
				if(!attachment.name || !attachment.name.endsWith(".botcmd")) {
					await message.reply("Uploaded file is not a bot command.");
					continue;
				}
				try {
					let file = await fetch(attachment.url);
					file.body.pipe(fs.createWriteStream("./commands/"+attachment.name));
					await message.reply("Uploaded " + attachment.name);
					await logChannels.important.send({content:`Command \`.${attachment.name.split(".botcmd").slice(0,-1).join(".botcmd")}\` uploaded by ${message.member}`,allowedMentions:{parse:[]}, files: [new AttachmentBuilder(`./commands/${attachment.name}`)]});
				} catch(err) {
					await message.reply("Unable to upload " + attachment.name + ". Error info: " + (err?(err.message??"syke lmao"):"syke lmao"));
				}
			}
		}
	}
};

async function msgDeleteHandler(message) {
	if(!logChannels) return;
	if (message.author.bot) return;
	if (message.attachments.size > 0) {
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
		await logChannels.normal.send({ content: messageText, flags: [4096], files });
	}
};

async function interactionCreateHandler(interaction) {
	if(!interaction.isChatInputCommand()) return;
	if(!cogsLoaded) {
		await interaction.reply("Please wait before sending any commands, the bot is currently restarting...");
		return;
	}
	try {
		if(cogs.hasOwnProperty("customCommandSlash") && cogs.customCommandSlash.hasOwnProperty("onChatInteraction")) {
			await cogs.customCommandSlash.onChatInteraction(interaction);
		}
	} catch(err) {
		console.error(err);
		let errorMessage = `An unhandled exception occurred when executing the command. It has been logged in a staff-only channel. Please contact a Bot Maintainer for more information.`;
		if(interaction.replied || interaction.deferred) {
			await interaction.followUp(errorMessage);
		} else {
			await interaction.reply(errorMessage);
		}
	}
	for(let cogName in cogs) {
		if(cogs[cogName].hasOwnProperty('commands')) {
			if(!cogs[cogName].commands.hasOwnProperty(interaction.commandName)) continue;
			let cogCommand = cogs[cogName].commands[interaction.commandName];
			if(!cogCommand.hasOwnProperty('slash')) continue;
			let cogArgs = {};
			if(!interaction.options.getSubcommand(false)) {
				if(Array.isArray(interaction.options.data)) {
					for(var param of interaction.options.data) {
						cogArgs[param.name] = param.value;
					}
				}
			} else {
				if(Array.isArray(interaction.options.data) && interaction.options.data.length && Array.isArray(interaction.options.data[0]?.options)) {
					for(var param of interaction.options.data[0].options) {
						cogArgs[param.name] = param.value;
					}
				}
			}
			if(!cogCommand.hasOwnProperty('handler')) {
				await interaction.reply(`Error: \`.${commandName}\` has no command handler!`);
				continue;
			}
			try {
				await cogCommand.handler(true, cogArgs, interaction, interaction.commandName);
			} catch(err) {
				console.error(err);
				await logChannels.important.send(`An error occurred with the ${cogName} cog.\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
				let errorMessage = `An unhandled exception occurred when executing the command. It has been logged in a staff-only channel. Please contact a Bot Maintainer for more information.`;
				if(interaction.replied || interaction.deferred) {
					await interaction.followUp(errorMessage);
				} else {
					await interaction.reply(errorMessage);
				}
			}
		}
	}
};

function exit() {
	console.log("Received command to exit... exiting safely!");
	client.destroy();
	db.close();
	process.exit(0);
}
process.on('SIGINT', exit);
process.on('SIGBREAK', exit);
process.on('SIGTERM', exit);

async function clientReady() {
	console.log('Ready! Logged in as ' + client.user.tag);
	console.log("Message Content Intent Access: " + msgContentIntent.toString().toUpperCase() + (!config.attemptPrivilegedIntents ? " (Disabled in config)" : ""));
	client.user.setPresence({
		activities: [{
			name: "Stay Funky and Happy Modding!",
			type: ActivityType.Playing
		}],
		status: "online"
	});
	logChannels.normal = await client.channels.fetch(config.logChannelId);
	logChannels.important = await client.channels.fetch(config.importantLogChannelId);
	try {
		let embed = new EmbedBuilder();
		embed.setTitle("FunkyHelper is online!");
		embed.setDescription("The bot has just started. If this happens several times within a few minutes, the bot may be crashing. Please notify a Bot Maintainer if so.");
		embed.setColor("Aqua");
		await logChannels.important.send({embeds:[embed]});
	} catch(err) {
		console.log("Failed to send startup message.\n"+err);
	}
	const commandsDir = path.join(__dirname, 'commands');
	if (!fs.existsSync(commandsDir)) {
		fs.mkdirSync(commandsDir, { recursive: true });
	}
	const aliasDir = path.join(__dirname, 'alias');
	if (!fs.existsSync(aliasDir)) {
		fs.mkdirSync(aliasDir, { recursive: true });
	}

	botContext.havePermission = havePermission;
	botContext.exit = exit;
	botContext.guild = await client.guilds.fetch(config.guildId);
	botContext.msgContentIntent = msgContentIntent;

	fs.readdirSync(path.join(__dirname, 'cogs')).forEach(file=>{
		if(file.endsWith(".js")) {
			var cogName = path.basename(file, '.js');
			cogs[cogName] = (require(path.join(__dirname, 'cogs', cogName)))(client, logChannels, config, botContext);
		}
	});

	var {promise, resolve} = Promise.withResolvers();
	botContext.customCommandCogLoaded = promise;
	var oldSystemCmdCount = 0;
	var newSystemCmdCount = 0;

	for(let cogName in cogs) {
		if(cogs[cogName].hasOwnProperty("onReady")) {
			if(cogs[cogName].hasOwnProperty("noAwait") && cogs[cogName].noAwait) {
				cogs[cogName].onReady();
			} else {
				await cogs[cogName].onReady();
			}
		}
		// TODO: Remove once all commands are migrated to new system.
		if(cogs[cogName].hasOwnProperty("commandList")) {
			commandList.push(...cogs[cogName].commandList);
			oldSystemCmdCount+=cogs[cogName].commandList.length;
		}
		if(cogs[cogName].hasOwnProperty("commands")) {
			commandList.push(...Object.keys(cogs[cogName].commands));
			newSystemCmdCount+= Object.values(cogs[cogName].commands).map(o=>o.prefix.aliases ? o.prefix.aliases.length + 1 : 1).reduce((a,b)=>(a+b),0);
		}
	}

	var total = oldSystemCmdCount + newSystemCmdCount;
	console.log(`New System Migration Status: ${newSystemCmdCount}/${total}. ${~~((newSystemCmdCount/total)*100)}% complete!`);

	if(cogs.hasOwnProperty("customCommand")) {
		botContext.customCommandCog = cogs.customCommand;
		resolve();
	}

	cogsLoaded = true;

	await web.init(config);

	setInterval(processTimers, 1000);
};

(async()=>{
	try {
		await client.login(config.token);
	} catch(err) {
		if(err.message == "Used disallowed intents") {
			await client.destroy();
			client = defineClient(false);
			msgContentIntent = false;
			await client.login(config.token);
		} else {
			throw err;
		}
	}
})();

function havePermission(member) {
	return member.roles.cache.some(role => config.allowRoleList.includes(role.id));
}

async function generateWikiPage(wikiCommand) {
	try {
		if (!wikiCommand.length) return;
		wikiCommand = wikiCommand[0].toUpperCase() + wikiCommand.slice(1).replace(/ /g, "_");
		let response = await fetch(`https://wiki.hacks.guide/w/api.php?action=query&meta=siteinfo&siprop=general&iwurl=true&titles=${encodeURIComponent(wikiCommand.split("#")[0])}&format=json`).then(res => res.json());
		if (response.query?.interwiki?.[0]?.url) return `<${response.query.interwiki[0].url}>`;
		if (response.query?.normalized?.[0]?.to) wikiCommand = response.query.normalized[0].to.replace(/ /g, "_");;
		return `<https://wiki.hacks.guide/wiki/${wikiCommand}>`;
	} catch(err) {
		return "failed";
	}
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
		if (wikiURL == "failed") {
			await message.channel.send("Failed to get wiki links, the wiki is likely down.");
			return;
		}
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


async function processTimers() {
	await cogs.stickyMessages.processTimers();
	await cogs.misc.processTimers();
}
