const { EmbedBuilder } = require('discord.js');
const util = require("../util");
const fs = require("fs");
const path = require("path");
var stickyMessages = {};
var timers = {};
var stickyMessageFile = path.resolve("./stickyMessage.json");

module.exports = (client, logChannels, config) => {
    async function onReady() {
        if(fs.existsSync(stickyMessageFile)) {
            var stickyMessagesToDelete = require(stickyMessageFile);
            for(let channelId in stickyMessagesToDelete) {
                try {
                    let messageId = stickyMessagesToDelete[channelId];
                    let channel = await client.channels.fetch(channelId);
                    let message = await channel.messages.fetch(messageId);
                    await message.delete();
                } catch(err) {
                    await logChannels.important.send(`Failed to delete sticky message on bot startup. Message Info below:\n${channelId}: ${stickyMessagesToDelete[channelId]}\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
                }
            }
        }
        stickyMessages = {};
        updateStickyMessageFile();
        for(let channelId in config.stickyMessageChannels) {
            try {
                let channel = await client.channels.fetch(channelId);
                await sendStickyMessage(channel,config.stickyMessageChannels[channelId]);
            } catch(err) {
                await logChannels.important.send(`Failed to send sticky message on bot startup. Channel ID: ${channelId}\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
            }
        }
    }

    async function onMessage(message) {
        if(config.stickyMessageChannels.hasOwnProperty(message.channel.id) && Object.keys(stickyMessages).includes(message.channel.id)) {
            timers[message.channel.id] = 120;
        }
    }

    async function processTimers() {
        for(var channelId in timers) {
            if(timers[channelId]>0) {
                timers[channelId]--;
            } else {
                delete timers[channelId];
                try {
                    var channel = await client.channels.fetch(channelId);
                } catch(err) {
                    await logChannels.important.send(`Failed to get channel with ID ${channelId} for refreshing sticky message.`);
                    return;
                }
                let oldId = stickyMessages[channelId];
                delete stickyMessages[channelId];
                updateStickyMessageFile();
                try {
                    let oldStickyMessage = await channel.messages.fetch(oldId);
                    if(oldStickyMessage) await oldStickyMessage.delete();
                } catch(err) {
                    await logChannels.important.send(`Failed to delete old sticky message in <#${channel.id}> after message sent.\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
                }
                await sendStickyMessage(channel,config.stickyMessageChannels[channelId]);
            }
        }
    }

    async function sendStickyMessage(channel,embedTypes) {
        var embeds = [];
        for(var type of embedTypes) {
            if(type == "switchPiracy") {
                var embed = new EmbedBuilder();
                embed.setTitle("Reminder: No Switch Piracy!");
                embed.setDescription("If you ask for or give assistance with obtaining or using pirated Nintendo Switch games, you may face moderation action up to and including a permanent ban from the server.");
                embed.setFooter({text:"This message will always appear at the bottom of relevant channels. Stay Funky and Happy Modding!"});
                embed.setColor("Gold");
            } else if(type=="botCmds") {
                var embed = new EmbedBuilder();
                embed.setTitle(`Please use <#${config.botCmdsChannelId}>!`);
                embed.setDescription(`If you are here to to use commands for yourself, please go to the <#${config.botCmdsChannelId}> channel. This makes it easier for helpers to give assistance to those who need it.`)
                embed.setFooter({text:"This message will always appear at the bottom of relevant channels. Stay Funky and Happy Modding!"});
                embed.setColor("Gold");
            } else if(type=="mcSmp") {
                var embed = new EmbedBuilder();
                embed.setTitle("How to join FunkyMC!");
                embed.setDescription(`**Version:** Any above 1.9, recommended is ${config.mcRecVersion}\n**IP:** funkyscott47.com\n**Port (Bedrock):** 19132 (default)\n\nIf you are not a cracked player (you have paid for a Minecraft account), run /premium upon joining.\nAt this point, you must verify with your Discord account.\nTo verify, click the Link button in <#${config.mc2faChannelId}> and type /link (code) in-game.\nFor more specific information about this server, check [here](${config.mcInfoLink}) and the other pins in this channel.`);
                embed.setColor("Green");
            } else if(type=="matchmaking") {
                var embed = new EmbedBuilder();
                embed.setTitle("Ping to find players!");
                embed.setDescription(`Do you wanna find members to play with? Type \`.matchmaking\` in this channel to ping <@&${config.matchmakingRoleId}>. This command can only be used every 10 minutes, please do not spam it.\n-# If you do not wish to receive these pings, go to <id:customize> and remove the Matchmaking role.`);
            } else if(type=="appeals") {
                var embed = new EmbedBuilder();
                embed.setTitle(`No Chatting, Appeals Only!`);
                embed.setDescription(`This channel is solely used for appealing restrictions that have been applied to you.\n**Do not send any messages in this channel unless:**\n* You are appealing\n* You are staff\n* You are involved in the current incident\n\nStaff can handle all incidents without outsider's opinions.\nIf you would like to appeal a restriction, you may find [this template](${config.appealsTemplateLink}) helpful.`);
                embed.setColor("DarkRed");
            } else {
                logChannels.important.send(`Sticky message type \`${type}\` does not exist. (Creating sticky messsage in ${channel})`);
                continue;
            }
            embeds.push(embed);
        }
        try {
            let message = await channel.send({embeds});
            stickyMessages[channel.id] = message.id;
            updateStickyMessageFile();
        } catch(err) {
            console.error(err);
            logChannels.important.send(`Failed to create sticky message in ${channel?("<#"+channel.id+">"):"unknown channel (lol)"}.\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
        }
    }

    function updateStickyMessageFile() {
        fs.writeFileSync(stickyMessageFile, JSON.stringify(stickyMessages, null, 2));
    }

    return {
        onReady,
        onMessage,
        processTimers,
        updateStickyMessageFile,
        sendStickyMessage
    }
}