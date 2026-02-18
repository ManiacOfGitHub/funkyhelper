const { EmbedBuilder } = require('discord.js');
const util = require("./util");
const fs = require("fs");
const path = require("path");
var stickyMessages = {};
var timers = {};
var stickyMessageFile = path.resolve("./stickyMessage.json");

module.exports = (client, logChannel, config) => {
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
                    await logChannel.send(`Failed to delete sticky message on bot startup. Message Info below:\n${channelId}: ${stickyMessagesToDelete[channelId]}\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
                }
            }
        }
        stickyMessages = {};
        updateStickyMessageFile();
        for(let channelId of config.stickyMessageChannels) {
            try {
                let channel = await client.channels.fetch(channelId);
                await sendStickyMessage(channel);
            } catch(err) {
                await logChannel.send(`Failed to send sticky message on bot startup. Channel ID: ${channelId}\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
            }
        }
    }

    async function onMessage(message) {
        if(config.stickyMessageChannels.includes(message.channel.id) && Object.keys(stickyMessages).includes(message.channel.id)) {
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
                    await logChannel.send(`Failed to get channel with ID ${channelId} for refreshing sticky message.`);
                    return;
                }
                let oldId = stickyMessages[channelId];
                delete stickyMessages[channelId];
                updateStickyMessageFile();
                try {
                    let oldStickyMessage = await channel.messages.fetch(oldId);
                    if(oldStickyMessage) await oldStickyMessage.delete();
                } catch(err) {
                    await logChannel.send(`Failed to delete old sticky message in <#${channel.id}> after message sent.\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
                }
                await sendStickyMessage(channel);
            }
        }
    }

    async function sendStickyMessage(channel) {
        try {
            let embed = new EmbedBuilder();
            embed.setTitle("Reminder: No Switch Piracy!");
            embed.setDescription("If you ask for or give assistance with obtaining or using pirated Nintendo Switch games, you may face moderation action up to and including a permanent ban from the server.");
            embed.setFooter({text:"This message will always appear at the bottom of relevant channels. Stay Funky and Happy Modding!"});
            embed.setColor("Gold");
            let message = await channel.send({embeds:[embed]});
            stickyMessages[channel.id] = message.id;
            updateStickyMessageFile();
        } catch(err) {
            console.error(err);
            logChannel.send(`Failed to create sticky message in ${channel?("<#"+channel.id+">"):"unknown channel (lol)"}>.\nError info: ${err?(err.message??"syke lmao"):"syke lmao"}`);
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