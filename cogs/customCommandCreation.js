const {REST, Routes, SlashCommandBuilder } = require("discord.js");
var db, customCommand;

module.exports = (client, logChannels, config, botContext) => {
    async function onReady() {
        await botContext.customCommandCogLoaded;
        customCommand = botContext.customCommandCog;
        db = botContext.db;
    }

    async function customRedeployCmdHandler(isSlash, params, ctx) {
        if(isSlash) await ctx.deferReply();
        var commands = customCommand.getCommandList.all();
        var slashCommands = [];
        if(!commands || commands.length == 0) return;
        for(var command in commands) {
            var consoles = [];
            if (!customCommand.searchDataNode(commands[command].id)) {
                var consoleNodeIds = customCommand.getConsoleNodes.all(commands[command].id).map(o=>o.id);
                if(!consoleNodeIds || !consoleNodeIds.length) continue;
                for(var consoleNodeId of consoleNodeIds) {
                    consoles.push(...customCommand.getConsoleNamesForConsole.all(consoleNodeId).map(o=>o.name));
                }
            };
            let slashCommand = new SlashCommandBuilder().setName(commands[command].name);
            if(commands[command].description) slashCommand.setDescription(commands[command].description);
            if(consoles.length > 0) {
                console.log(...consoles.map(console=>({name:console, value:console})));
                slashCommand.addStringOption((option)=>
                    option.setName("parameter").setDescription("Required if not in a channel that is related to the command.").addChoices(...consoles.map(console=>({name:console, value:console}))).setRequired(false)
                );
            }
            slashCommands.push(slashCommand);
        }
        console.log("Command data has loaded! Deploying with Discord API...");

        var rest = new REST().setToken(config.token);
        try {
            await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {body: slashCommands});
        } catch(err) {
            console.log("An error occurred while deploying commands:");
            console.error(err);
            return;
        }

        console.log("All guild (custom) commands were successfully deployed!");
    }

    return {
        commands: {
            customredeploy: {
                prefix: {
                    name: "customredeploy",
                    aliases: ["redeploycustom"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("customredeploy")
                    .setDescription("Redeploys all of the guild-only custom commands, Bot Owner only")
                },
                handler: customRedeployCmdHandler
            }
        },
        onReady,
        noAwait: true
    }
}