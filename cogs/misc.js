const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js")

module.exports = (client, logChannels, config, botContext) => {
    async function testCmdHandler(isSlash, params, ctx) {
        const embed = new EmbedBuilder().setDescription("This is a test message.");
        await ctx.reply({ embeds: [embed] });
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
            }
        }
    }
}