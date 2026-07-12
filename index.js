const { Client, Events, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, ActivityType, AuditLogEvent, Attachment } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const util = require('./util');
const web = require('./web');

var config = require('./config.json');
const { log } = require('console');
var client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration, GatewayIntentBits.MessageContent], allowedMentions: {parse: ['users'], roles: [config.activeModeratorsId]}});
var matchmakingTimer = 0;
var logChannels = {normal: null, important: null};

const commandsDir = path.join(__dirname, 'commands');
const aliasDir = path.join(__dirname, "alias");

var cogs = {};
var cogsLoaded = false;
var clientState = {};

client.on("messageCreate", async (message) => {
	if (!message.guild || message.author.bot) return;
	if(!cogsLoaded) {
		if(message.content.startsWith(".")) {
			await message.reply("Please wait before sending any commands, the bot is currently restarting...");
		}
		return;
	}
	await cogs.stickyMessages.onMessage(message);

	(async()=>{
		try {
			await cogs.withdrawalScam.onMessage(message);
		} catch(err) {
			console.error(err);
			await logChannels.important.send("An error occurred with the withdrawalScam cog. \nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
			await cogs.withdrawalScam.liftLock();
		}
	})();

	let args = message.content.split(" ");
	let commandName = (args[0] ? args[0].slice(1) : "").toLowerCase();
	await processWikiCommands(message);

	if(message.content.startsWith(".")) {
		for(let cogName in cogs) {
			if(cogs[cogName].hasOwnProperty('onCommand')) {
				try {
					await cogs[cogName].onCommand(commandName, args, message);
				} catch(err) {
					console.error(err);
					await logChannels.important.send(`An error occurred with the ${cogName} cog.\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
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
		if (["create", "delete", "help", ".", "test", "alias", "deletealias", "helpalias", "switchpiracy", "sp", "echo", "echobypass", "say", "saybypass", "reply", "replybypass", "edit", "editbypass", "pull", "stop", "config", "onbreak", "offbreak", "lock", "unlock", "addconsole", "removeconsole", "delconsole", "source", "upload", "birthday", "birth", "cake", "addprop", "removeprop", "delprop", "ban", "yeet", "scamkick"].includes(commandName.toLowerCase()) || (commandName.startsWith(".") || commandName === "")) {
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

	if (message.content === ".test") {
		const embed = new EmbedBuilder().setDescription("This is a test message.");
		message.channel.send({ embeds: [embed] });
	}

	if([".say",'.echo','.saybypass','.echobypass'].includes(message.content.split(" ")[0].toLowerCase())) {
		var bypassMode = commandName.endsWith("bypass");
		if(bypassMode) {
			if(!message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
				return message.reply("no");
			}
		} else {
			if (!message.member.roles.cache.some(role => config.staffRoleList.includes(role.id)) && !havePermission(message.member)) {
				return message.reply("no");
			}
		}
		if(args.length < 2) {
			await message.reply("Not enough arguments");
			return;
		}
		var channel, sliceAt;
		let channelId = args[1].matchAll(/\d/g).toArray().join("");
		if(channelId) {
			try {
				channel = await message.guild.channels.fetch(channelId);
			} catch(err) {}
		}
		if(!channel) {
			channel = message.channel;
			channelId = channel.id;
			sliceAt = 1
		} else {
			if (args.length < 3) {
				await message.reply("Not enough arguments");
				return;
			}
			sliceAt = 2
		}
		if((!config.echoChannelIds.includes(channelId)) && !message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
			await message.reply(`You cannot \`.${commandName}\` into ${sliceAt==1?"this":"that"} channel. You can \`.${commandName}\` into: ${config.echoChannelIds.map(o=>`<#${o}>`).join(", ")}`);
			return;
		}	
		try {
			if(bypassMode) {
				var sentMessage = await channel.send({content:args.slice(sliceAt).join(" "),allowedMentions:{parse:['roles','users','everyone']}});
			} else {
				var sentMessage = await channel.send(args.slice(sliceAt).join(" "));
			}
			let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${commandName} was used to send a message`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Sent [a message](${sentMessage.url}) in <#${channelId}>:\n${args.slice(sliceAt).join(" ")}`);
			logEmbed.setFooter({text:"ID: " + sentMessage.id});
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
		} catch(err) {
			console.error(err);
			await logChannels.important.send("Failed to send message (does the bot have permission to speak there?)\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
		try {
			await message.delete();
		} catch(err) {
			//I really don't care enough to do anything with this.
		}
	}	

	if([".reply",'.replybypass'].includes(message.content.split(" ")[0].toLowerCase())) {
		if (args.length < 2) {
			await message.reply("Not enough arguments");
			return;
		}
		let autoMode = !!message.reference;
		if(args.length < (autoMode ? 2 : 4)) {
			await message.reply("Not enough arguments");
			return;
		}

		let channelId, messageId, sliceAt;
		if (autoMode) {
			sliceAt = 1;
			channelId = message.channel.id
			messageId = (await message.fetchReference());
		} else {
			sliceAt = 3;
			channelId = args[1].matchAll(/\d/g).toArray().join("");
			messageId = args[2].matchAll(/\d/g).toArray().join("");
		}
		var bypassMode = commandName.endsWith("bypass");
		if(bypassMode) {
			if(!message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
				return message.reply("no");
			}
		} else {
			if (!message.member.roles.cache.some(role => config.staffRoleList.includes(role.id)) && !havePermission(message.member)) {
				return message.reply("no");
			}
		}
		
		var channel;
		if((!config.echoChannelIds.includes(channelId)) && !message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
			await message.reply(`You cannot \`.reply\` into ${autoMode?"this":"that"} channel. You can \`.reply\` into: ${config.echoChannelIds.map(o=>`<#${o}>`).join(", ")}`);
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
			if(bypassMode) {
				var sentMessage = await messageToReplyTo.reply({content:args.slice(sliceAt).join(" "),allowedMentions:{parse:['roles','users','everyone'],repliedUser:true}});
			} else {
				var sentMessage = await messageToReplyTo.reply({content:args.slice(sliceAt).join(" "),allowedMentions:{repliedUser: false}});
			}
			let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${commandName} was used to reply to a message`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Sent [a reply](${sentMessage.url}) to [a message](${(await sentMessage.fetchReference()).url}) in <#${channelId}>:\n${args.slice(sliceAt).join(" ")}`);
			logEmbed.setFooter({text:"ID: " + sentMessage.id});
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds:[logEmbed],allowedMentions:{parse:[]}});
		} catch(err) {
			console.error(err);
			await logChannels.important.send("Failed to send message (does the bot have permission to speak there?)\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
		try {
			await message.delete();
		} catch(err) {
			//I really don't care enough to do anything with this.
		}
	}

	if([".edit",'.editbypass'].includes(message.content.split(" ")[0].toLowerCase())) {
		var bypassMode = commandName.endsWith("bypass");
		if(bypassMode) {
			if(!message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
				return message.reply("no");
			}
		} else {
			if (!message.member.roles.cache.some(role => config.staffRoleList.includes(role.id)) && !havePermission(message.member)) {
				return message.reply("no");
			}
		}
		let autoMode = !!message.reference;
		if(args.length < (autoMode ? 2 : 4)) {
			await message.reply("Not enough arguments");
			return;
		}

		let channelId, messageId, sliceAt;
		if (autoMode) {
			sliceAt = 1;
			channelId = message.channel.id
			messageId = (await message.fetchReference());
		} else {
			sliceAt = 3;
			channelId = args[1].matchAll(/\d/g).toArray().join("");
			messageId = args[2].matchAll(/\d/g).toArray().join("");
		}
		var channel;
		if((!config.echoChannelIds.includes(channelId)) && !message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
			await message.reply(`You cannot \`.edit\` messages in ${autoMode?"this":"that"} channel. You can \`.edit\` messages in : ${config.echoChannelIds.map(o=>`<#${o}>`).join(", ")}`);
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
		let messageToEdit;
		if(messageId) {
			try {
				messageToEdit = await channel.messages.fetch(messageId);
			} catch(err) {};
		}
		if(!messageToEdit) {
			await message.reply("Message not found.");
			return;
		}
		if(messageToEdit.author.id != client.user.id) {
			await message.reply("Message was not sent by bot.");
			return;
		}
		let oldContent = messageToEdit.content;
		try {
			if(bypassMode) {
				await messageToEdit.edit({content:args.slice(sliceAt).join(" "),allowedMentions:{parse:['roles','users','everyone'],repliedUser:true}});
			} else {
				await messageToEdit.edit({content:args.slice(sliceAt).join(" "),allowedMentions:{parse: ['users'], repliedUser: false}});
			}
			let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${commandName} was used to edit a message`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Edited [a message](${messageToEdit.url}) in <#${channelId}>:\n**Old Content:** ${oldContent}\n**New Content:** ${args.slice(sliceAt).join(" ")}`);
			logEmbed.setFooter({text:"ID: " + messageToEdit.id});
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds:[logEmbed],allowedMentions:{parse:[]}});
		} catch(err) {
			console.error(err);
			await logChannels.important.send("Failed to edit message (does the bot have permission to speak there?)\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
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
			await message.channel.send({content:"<@&"+config.matchmakingRoleId+">\n**Someone would like to play!**\n-# If you do not wish to receive these pings, go to <id:customize> and remove the Matchmaking role.", allowedMentions: {roles: [config.matchmakingRoleId]}});
		}
	}

	if(message.content.split(" ")[0].toLowerCase() == ".pingmc") {
		if(!util.hasRole(message.member, [config.moderatorRole, config.mcManagerRoleId]) && !config.botOwners.includes(message.member.id)) {
			await message.channel.send("no");
			return;
		}
		if(args.length > 1) {
			await message.channel.send({content:`<@&${config.mcPingRoleId}>\n${args.slice(1).join(" ")}`,allowedMentions:{roles:[config.mcPingRoleId]}});
		} else {
			await message.channel.send({content:`<@&${config.mcPingRoleId}>`,allowedMentions:{roles:[config.mcPingRoleId]}});
		}
		await message.delete();
	}

	if([".switchpiracy",".sp"].includes(message.content.split(" ")[0].toLowerCase())) {
		return await message.channel.send("The Switch Piracy Watchlist is no more!\nIf you are staff, please refer to this message for more information: https://discord.com/channels/1041089944673853490/1413260588280451072/1503548955911389264.\n-# This is a temporary message and will be deleted eventually.");
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
		if (!config.botOwners.includes(message.member.id)) {
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

	if(message.content.split(" ")[0].toLowerCase() == ".source") {
		if(!havePermission(message.member)) {
			return message.reply("You do not have permission to view the source of commands.");
		}
		if(args.length < 2) {
			return message.reply("Not enough arguments.");
		}
		if(!fs.existsSync(`./commands/${args[1]}.botcmd`)) {
			return message.reply("Command does not exist.");
		}
		var data = fs.readFileSync(`./commands/${args[1]}.botcmd`, 'utf-8');
		if(data.length <= 2000) {
			await message.reply({
				content: data,
				files: [new AttachmentBuilder(`./commands/${args[1]}.botcmd`)]
			});
		} else {
			await message.reply({
				content: "Over 2000 characters, cannot send, please view file below",
				files: [new AttachmentBuilder(`./commands/${args[1]}.botcmd`)]
			});
		}
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
});

client.on("messageDelete", async (message) => {
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

	clientState.havePermission = havePermission;

	fs.readdirSync(path.join(__dirname, 'cogs')).forEach(file=>{
		if(file.endsWith(".js")) {
			var cogName = path.basename(file, '.js');
			cogs[cogName] = (require(path.join(__dirname, 'cogs', cogName)))(client, logChannels, config, clientState);
		}
	});

	for(let cogName in cogs) {
		if(cogs[cogName].hasOwnProperty("onReady")) {
			await cogs[cogName].onReady();
		}
	}

	cogsLoaded = true;

	await web.init(config);

	setInterval(processTimers, 1000);
});

client.login(config.token);

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
	if(matchmakingTimer > 0) {
		matchmakingTimer--;
	}
}
