var fs = require("fs");
var {EmbedBuilder} = require("discord.js");
var util = require('../util');
var commandList = ["config", "addconfig","viewconfig"];

module.exports = (client, logChannels, config, clientState) => {
    async function onCommand(command, args, message) {
	    if(!commandList.includes(command)) return;
		if (!util.hasRole(message.member, config.allowRoleList)) {
			return message.reply("no");
		}
		let content = args.slice(1).join(" ");
		if(command == "viewconfig") {
			if(!config.hasOwnProperty(content)) {
				return message.reply({content:`The config has no \`${content}\` property.`,allowedMentions:{parse:[]}});
			}
			if(content == "token") {
				return message.reply("Are you fr rn?");
			}
			if(!config.staffConfig.includes(content) && !config.botOwners.includes(message.member.id)) {
				return message.reply(`You cannot view the \`${content}\` property of the config as you are not a Bot Owner.`);
			}
			return message.reply(`\`${JSON.stringify(config[content])}\``);
		}
		if(!content.startsWith("`") || !content.endsWith("`")) {
			return message.reply("You must surround JSON with backticks (`)");
		}
		content = content.slice(1,-1);
		try {
			content = JSON.parse(content);
		} catch(err) {
			return message.reply("Failed to parse as JSON.");
		}
		var notChanged = [];
		var changedSomething = false;
		for(let i in content) {
			if (!config.staffConfig.includes(i) && !config.botOwners.includes(message.member.id)) {
				notChanged.push(i);
				continue;
			}
			if(i=="token") {
				notChanged.push(i);
				continue;
			}
			changedSomething = true;
            if (command == "addconfig") {
				if(Array.isArray(config[i])) {
			        config[i].push(content[i]);
                } else {
					config[i] = [content[i]];
                }
            } else {
                config[i] = content[i];
            }
		}
		 
		try {
			fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
		} catch(err) {
			return message.reply("Failed to save config to file.");
		}
        let logEmbed = new EmbedBuilder();
		logEmbed.setTitle(`.${command} was used to edit the config`);
		logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
		logEmbed.setFooter({text:"ID: " + message.member.id});
		logEmbed.setTimestamp();
		await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});

		var notChangedStr = notChanged.map(prop=>`\`${prop}\`${prop=="token"?" (what is wrong with you)":""}`).join(" ");
		if(changedSomething) {
			if(notChanged.length > 0) {
				await message.reply(`The following properties could not be set due to you not being a Bot Owner:\n${notChangedStr}\nAll other properties were successfully set.`);
			} else {
				await message.reply(`All properties were successfully set!`);
			}
		} else {
			if(notChanged.length > 0) {
				await message.reply(`None of the properties specified were able to be set due to you not being a Bot Owner.`);
			} else {
				await message.reply(`No properties were specified.`);
			}
		}
    }
    return {
        onCommand,
		commandList
    }
}