const {OverwriteType, PermissionFlagsBits, EmbedBuilder, Embed} = require('discord.js');
var fs = require('fs');
const path = require("path");
var lockedData = {};
var lockedDataFile = path.resolve("./lockedData.json");

module.exports = (client, logChannel, config) => {
    async function onReady() {
        if(fs.existsSync(lockedDataFile)) {
            lockedData = require(lockedDataFile);
        }
    }

    async function onCommand(command, args, message) {
        if(command == "lock") {
            if(!config.fullPermsMode) {
                await message.channel.send("You cannot use this command when `fullPermsMode` is disabled.");
                return;
            }
            if(!message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            if(lockedData[message.channel.id]) {
                await message.channel.send("This channel is already locked.");
                return;
            }
            var moderatorOverwriteExists = message.channel.permissionOverwrites.cache.some(o=>o.type==OverwriteType.Role&&o.id==config.moderatorRole);
            var botOverwriteExists = message.channel.permissionOverwrites.cache.some(o=>o.type==OverwriteType.Member&&o.id==client.user.id);
            var everyoneSendAllowed = message.channel.permissionOverwrites.cache.some(o=>o.type==OverwriteType.Role&&o.id==message.guild.roles.everyone.id&&o.allow.has(PermissionFlagsBits.SendMessages));
            var everyoneSendDenied = message.channel.permissionOverwrites.cache.some(o=>o.type==OverwriteType.Role&&o.id==message.guild.roles.everyone.id&&o.deny.has(PermissionFlagsBits.SendMessages));
            await message.channel.permissionOverwrites.edit(config.moderatorRole, {SendMessages:true});
            await message.channel.permissionOverwrites.edit(client.user.id, {SendMessages:true});
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {SendMessages:false});
            lockedData[message.channel.id] = {
                moderatorOverwriteExists,
                botOverwriteExists,
                everyoneState: null
            }
            if(everyoneSendAllowed) {
                lockedData[message.channel.id].everyoneState = true;
            } else if(everyoneSendDenied) {
                lockedData[message.channel.id].everyoneState = false;
            }
            fs.writeFileSync(lockedDataFile, JSON.stringify(lockedData, null, 2));
            let lockedEmbed = new EmbedBuilder();
            lockedEmbed.setTitle(":lock: This channel is now locked down.");
            lockedEmbed.setDescription(`Only users with <@&${config.moderatorRole}> or higher can speak. Do not bring the topic to other channels or you may face moderation action.`);
            lockedEmbed.setColor("Red");
            await message.channel.send({embeds:[lockedEmbed], allowedMentions: {roles:[]}});
        } else if(command == "unlock") {
            if(!config.fullPermsMode) {
                await message.channel.send("You cannot use this command when `fullPermsMode` is disabled.");
                return;
            }
            if(!message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            if(!lockedData[message.channel.id]) {
                await message.channel.send("This channel is already unlocked.");
                return;
            }
            if(!lockedData[message.channel.id].moderatorOverwriteExists) {
                await message.channel.permissionOverwrites.delete(config.moderatorRole);
            }
            if(!lockedData[message.channel.id].botOverwriteExists) {
                await message.channel.permissionOverwrites.delete(client.user.id);
            }
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {SendMessages: lockedData[message.channel.id].everyoneState});
            delete lockedData[message.channel.id];
            fs.writeFileSync(lockedDataFile, JSON.stringify(lockedData, null, 2));
            let unlockedEmbed = new EmbedBuilder();
            unlockedEmbed.setTitle(":unlock: This channel is now unlocked.");
            unlockedEmbed.setColor("Blue");
            await message.channel.send({embeds: [unlockedEmbed]});
        }
    }
    return {
        onReady,
        onCommand
    }
}