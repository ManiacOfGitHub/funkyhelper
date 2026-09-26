var fs = require("fs");
var {EmbedBuilder, SlashCommandBuilder, InteractionContextType} = require("discord.js");
var util = require('../util');

module.exports = (client, logChannels, config, botContext) => {
    async function configCmdHandler(isSlash, params, ctx, commandName) {
		var reply = util.ctxReplier(ctx, isSlash);
		if(isSlash) await ctx.deferReply();
		if (!util.hasRole(ctx.member, config.allowRoleList)) {
			return reply("no");
		}
		let content = params.json;
		if(!content.startsWith("`") || !content.endsWith("`")) {
			if(!isSlash) {
				return await reply("You must surround JSON with backticks (`) when using prefix commands.");
			}
		} else {
			content = content.slice(1,-1);	
		}
		try {
			content = JSON.parse(content);
		} catch(err) {
			return await reply("Failed to parse as JSON.");
		}
		var notChanged = [];
		var changedSomething = false;
		for(let i in content) {
			if (!config.staffConfig.includes(i) && !config.botOwners.includes(ctx.member.id)) {
				notChanged.push(i);
				continue;
			}
			if(i=="token") {
				notChanged.push(i);
				continue;
			}
			changedSomething = true;
            if (commandName == "addconfig") {
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
			return await reply("Failed to save config to file.");
		}
        let logEmbed = new EmbedBuilder();
		logEmbed.setTitle(`${util.commandStr(commandName, isSlash)} was used to edit the config`);
		logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
		logEmbed.setFooter({text:"ID: " + ctx.member.id});
		logEmbed.setTimestamp();
		await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});

		var notChangedStr = notChanged.map(prop=>`\`${prop}\`${prop=="token"?" (what is wrong with you)":""}`).join(", ");
		if(changedSomething) {
			if(notChanged.length > 0) {
				await reply(`The following properties could not be set due to you not being a Bot Owner:\n${notChangedStr}\nAll other properties were successfully set.`);
			} else {
				await reply(`All properties were successfully set!`);
			}
		} else {
			if(notChanged.length > 0) {
				await reply(`None of the properties specified were able to be set due to you not being a Bot Owner.${notChanged.includes("token")?" Well, actually, it's because you tried to set the token. What is wrong with you?":""}`);
			} else {
				await reply(`No properties were specified.`);
			}
		}
    }

	async function viewConfigCmdHandler(isSlash, params, ctx) {
		var reply = util.ctxReplier(ctx, isSlash);
		if(isSlash) await ctx.deferReply();
		if (!util.hasRole(ctx.member, config.allowRoleList)) {
			return reply("no");
		}
		if(!config.hasOwnProperty(params.property)) {
			return reply({content:`The config has no \`${params.property}\` property.`,allowedMentions:{parse:[]}});
		}
		if(params.property == "token") {
			return reply("Are you fr rn?");
		}
		return reply(`\`${JSON.stringify(config[params.property])}\``);
	}

    return {
		commands: {
			config: {
				prefix: {
					name: "config",
					params: [
						{
							name: "json",
							type: "longtext"
						}
					]
				},
				slash: {
					data: new SlashCommandBuilder()
					.setName("config")
					.setDescription("Set config.json properties, Bot Maintainer only")
					.addStringOption(option=>option.setName("json").setDescription("JSON data to append to config.json").setRequired(true))
					.setContexts(InteractionContextType.Guild)
				},
				handler: configCmdHandler
			},
			addconfig: {
				prefix: {
					name: "addconfig",
					params: [
						{
							name: "json",
							type: "longtext"
						}
					]
				},
				slash: {
					data: new SlashCommandBuilder()
					.setName("addconfig")
					.setDescription("Add items to an array in config.json, Bot Maintainer only")
					.addStringOption(option=>option.setName("json").setDescription("JSON data, {arrayKey: [valuesToAppend]}").setRequired(true))
					.setContexts(InteractionContextType.Guild)
				},
				handler: configCmdHandler
			},
			viewconfig: {
				prefix: {
					name: "viewconfig",
					params: [
						{
							name: "property",
							type: "text"
						}
					]
				},
				slash: {
					data: new SlashCommandBuilder()
					.setName("viewconfig")
					.setDescription("Output the value of a property in config.json, Bot Maintainer only")
					.addStringOption(option=>option.setName("property").setDescription("JSON key"))
				},
				handler: viewConfigCmdHandler
			}
		}
    }
}
