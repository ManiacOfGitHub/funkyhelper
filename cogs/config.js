var fs = require("fs");
var {EmbedBuilder} = require("discord.js");
var util = require('../util');

module.exports = (client, logChannels, config, clientState) => {
    async function onCommand(command, args, message) {
	    if(!["config", "setconfig"].includes(command)) {
            return
        }
		if (!util.hasRole(message.member, config.allowRoleList)) {
			return message.reply("no");
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
			if (!(config.staffConfig.includes(i) || config.botOwners.includes(message.member.id))) {
				return message.reply("One or more options are not allowed to be added unless you are a bot owner");
			}
            if (command === "config") {
                try {
			        config[i].push(content[i]);
                } catch (error) {
                    if (error == "TypeError: Cannot read properties of undefined (reading 'push')") {
                        config[i] = [];
        		        config[i].push(content[i]);
                    }   
                }
            } else {
                config[i] = content[i]
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
		return message.reply("Updated config! In some cases, you may need to restart the bot for the changes to apply.");
    }
    return {
        onCommand
    }
}