const { EmbedBuilder } = require('discord.js');
var util = require('../util');
var fs = require('fs');
var path = require('path');
var botTrapPath = path.resolve("./botTrap.json");
var botTrapData;

module.exports = (client, logChannels, config, botContext) => {
    async function onReady() {
        if(!config.botTrapAutoActivate) return;
        if(fs.existsSync(botTrapPath)) {
            botTrapData = require(botTrapPath);
        } else {
            botTrapData = {};
        }
        try {
                var channel = await botContext.guild.channels.fetch(config.botTrapChannelId);
        } catch(err) {
            await logChannels.important.send(`Failed to get bot trap channel by ID.`);
            return;
        }
        try {
            var botMessage = await channel.messages.fetch(botTrapData.msgId);
        } catch(err) {
            var botMessage;
        }
        if(botContext.msgContentIntent && (!botMessage || !botTrapData.hasOwnProperty('active') || botTrapData.active)) {
            let embed = new EmbedBuilder()
            .setTitle("The bot trap is inactive.")
            .setDescription("Only staff can see the channel at the moment. This channel will become active, visible, and start kicking people if message content intents are ever lost. For now, your messages will just be deleted.")
            .setColor("Green");
            try {
                if(botMessage) {
                    await botMessage.edit({embeds:[embed]});
                } else {
                    throw Error();
                }
            } catch(err) {
                botTrapData.msgId = (await channel.send({embeds:[embed]})).id;
            }
            botTrapData.active = false;
            updateBotTrapFile();
            await channel.permissionOverwrites.edit(botContext.guild.roles.everyone, {ViewChannel: false});
        } else if(!botContext.msgContentIntent && (!botMessage || !botTrapData.hasOwnProperty('active') || !botTrapData.active)) {
            let embed = new EmbedBuilder()
            .setTitle("Do NOT send messages here or you will be kicked!")
            .setDescription("This is a trap for bots. If you send a message here, you will be kicked from the server. We recommend hiding this channel from your channel list in <id:customize>.")
            .setColor("DarkRed");
            try {
                if(botMessage) {
                    await botMessage.edit({embeds:[embed]});
                } else {
                    throw Error();
                }
            } catch(err) {
                botTrapData.msgId = (await channel.send({embeds:[embed]})).id;
            }
            botTrapData.active = true;
            updateBotTrapFile();
            await channel.permissionOverwrites.edit(botContext.guild.roles.everyone, {ViewChannel: true});
        }
    }

    async function onMessage(message) {
        if(!config.botTrapAutoActivate) return;
        if(message.channel.id != config.botTrapChannelId) return;
        if(botContext.msgContentIntent) {
            await message.delete();
            return;
        }

        var user = message.member;
        var userId = user.id;

        try {
            let scamKickedEmbed = new EmbedBuilder();
            scamKickedEmbed.setTitle("Suspicious Activity");
            scamKickedEmbed.setDescription("You have been kicked from " + message.guild.name + " due to messages that seem to be created by a bot that has hijacked your account. Once you have verified that your account is back under your control, you can rejoin [here](https://discord.gg/eVQkMaTQw2).");
            scamKickedEmbed.setColor("DarkRed");
            await user.send({embeds: [scamKickedEmbed]});
            await logChannels.important.send("DM succeeded!");
        } catch(err) {
            await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
        }

        try {
            await logChannels.important.send("Attempting to ban user (temporarily in order to remove messages)...");
            if(util.hasRole(user, config.staffRoleList)) throw Error("Member is staff, ban protection activated");
            await user.ban({deleteMessageSeconds: 60 * 60 * 24, reason: ".scamkick run by "+message.member.user.username});
        } catch(err) {
            await logChannels.important.send(`<@&${config.activeModeratorsId}> Warning! ${user} was unable to be banned!\nReason: ` + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        await logChannels.important.send("Ban succeeded. Attempting to unban user...");
        try {
            await botContext.guild.bans.remove(userId);
            await logChannels.important.send("Unban succeeded.");
        } catch(err) {
            await logChannels.important.send(`<@&${config.activeModeratorsId}> Warning! ${user} was unable to be unbanned! Please ensure that user is able to rejoin server.\nReason: ` + (err?(err.message??"syke lmao"):"syke lmao"));
        }

    }

    function updateBotTrapFile() {
        fs.writeFileSync(botTrapPath, JSON.stringify(botTrapData, null, 2));
    }

    return {
        onReady,
        onMessage
    };
}