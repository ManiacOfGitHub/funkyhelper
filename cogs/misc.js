const { SlashCommandBuilder, EmbedBuilder, MessageFlags, InteractionContextType } = require("discord.js");
var util = require('../util')
var child_process = require('child_process');
var matchmakingTimer = 0;

module.exports = (client, logChannels, config, botContext) => {
    async function testCmdHandler(isSlash, params, ctx) {
        const embed = new EmbedBuilder().setDescription("This is a test message.");
        await ctx.reply({ embeds: [embed] });
    }

    async function matchmakingCmdHandler(isSlash, params, ctx) {
        if(ctx.channel.id!=config.matchmakingChannelId) {
			await ctx.reply({content: "This command can only be used in <#" + config.matchmakingChannelId + ">", flags: MessageFlags.Ephemeral});
			return;
		}
		if(matchmakingTimer != 0) {
			var minutes = Math.floor(matchmakingTimer/60);
			var seconds = matchmakingTimer % 60;
			await ctx.reply({content:"This command is on cooldown. Wait " + (minutes ? minutes.toString() + " minute" + (minutes!=1 ? "s" : "") + " and " : "") + (seconds.toString() + " second" + (seconds!=1 ? "s" : "")) + " before sending again", flags: MessageFlags.Ephemeral});
		} else {
			matchmakingTimer = 60 * 10;
			await ctx.reply({content:"<@&"+config.matchmakingRoleId+">\n**Someone would like to play!**\n-# If you do not wish to receive these pings, go to <id:customize> and remove the Matchmaking role.", allowedMentions: {roles: [config.matchmakingRoleId]}});
		}
    }

    async function pullCmdHandler(isSlash, params, ctx) {
        let reply = util.ctxReplier(ctx, isSlash);
        if(!config.botOwners.includes(isSlash ? ctx.user.id : ctx.author.id)) {
			return await reply("You do not have permission to pull from the repo. (You must be part of the `botOwners` list)");
		}
        if(isSlash) await ctx.deferReply({flags: MessageFlags.Ephemeral});
        try {
            var stdout = child_process.execSync("git pull").toString();
        } catch(err) {
            console.error(err);
            return await reply({content: "Git pull failed somehow. Idk", flags: MessageFlags.Ephemeral});
        }
        if(stdout) await reply({content: stdout, flags: MessageFlags.Ephemeral});
        if(stdout == "Already up to date.\n") return;
        if(params.npm) {
            await reply({content: "Updating npm packages...", flags: MessageFlags.Ephemeral});
            try {
                var stdout = child_process.execSync("npm install").toString();
            } catch(err) {
                console.error(err);
                await reply({content: "npm install failed somehow. Idk", flags: MessageFlags.Ephemeral});
            }
            if(stdout) await reply({content: stdout, flags: MessageFlags.Ephemeral});
        }
        await reply({content: "Redeploying commands...", flags: MessageFlags.Ephemeral});
        await require('../deployCommands')();
        await reply({content: "Bot is now restarting...", flags: MessageFlags.Ephemeral});
        try {
            child_process.execSync("monit restart funkyhelper");
        } catch(err) {
            console.error(err);
            await reply({content: "Failed to restart bot. Exiting process safely..."});
            botContext.exit();
        }
    }

    async function restartCmdHandler(isSlash, params, ctx) {
        let reply = util.ctxReplier(ctx, isSlash);
		if (!config.botOwners.includes(isSlash ? ctx.user.id : ctx.author.id)) {
			return await reply("You do not have permission to restart the bot.");
		}
        if(params.redeploy) {
            await reply({content: "Redeploying commands...", flags: MessageFlags.Ephemeral});
            await require('../deployCommands')();
        }
		await reply({content: "Bot is now restarting...", flags: MessageFlags.Ephemeral});
		try {
            child_process.execSync("monit restart funkyhelper");
        } catch(err) {
            console.error(err);
            await reply({content: "Failed to restart bot using monit. Exiting process safely...", flags: MessageFlags.Ephemeral});
            botContext.exit();
        }
	}

    async function processTimers() {
        if(matchmakingTimer > 0) {
            matchmakingTimer--;
        }
    }

    return {
        commands: {
            test: {
                prefix: {
                    name: "test",
                    params: []
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("test")
                    .setDescription('Sends a test embed.')
                },
                handler: testCmdHandler
            },
            matchmaking: {
                prefix: {
                    name: "matchmaking",
                    params: []
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("matchmaking")
                    .setDescription("Pings the Matchmaking role, only works in #matchmaking")
                    .setContexts(InteractionContextType.Guild)
                },
                handler: matchmakingCmdHandler
            },
            pull: {
                prefix: {
                    name: "pull",
                    params: [
                        {
                            name: "npm",
                            type: "text",
                            process: async(param) => {
                                return param && param == "npm";
                            }
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("pull")
                    .setDescription("Executes git pull and reboots the bot, Bot Owner only")
                    .addBooleanOption(option => option.setName("npm").setDescription("Should the bot run npm install before restarting?").setRequired(false))
                },
                handler: pullCmdHandler
            },
            restart: {
                prefix: {
                    name: "restart",
                    aliases: ["stop"],
                    params: [
                        {
                            name: "redeploy",
                            type: "text",
                            process: async(param) => {
                                return param && param == "redeploy";
                            }
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("restart")
                    .setDescription("Restarts/stops the bot, Bot Owner only")
                    .addBooleanOption(option=>option.setName("redeploy").setDescription("Should the bot redeploy commands?").setRequired(false))
                },
                handler: restartCmdHandler
            }
        },
        processTimers
    }
}