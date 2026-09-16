const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
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
                },
                handler: matchmakingCmdHandler
            }
        },
        processTimers
    }
}