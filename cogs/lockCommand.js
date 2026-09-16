const {OverwriteType, PermissionFlagsBits, EmbedBuilder, Embed, SlashCommandBuilder, InteractionContextType} = require('discord.js');
var fs = require('fs');
const path = require("path");
var lockedData = {};
var lockedDataFile = path.resolve("./lockedData.json");
var util = require('../util')

module.exports = (client, logChannels, config) => {
    async function onReady() {
        if(fs.existsSync(lockedDataFile)) {
            lockedData = require(lockedDataFile);
        }
    }

    async function lockCmdHandler(isSlash, params, ctx) {
        if(isSlash) await ctx.deferReply();
        let reply = util.ctxReplier(ctx, isSlash);
        if(!config.fullPermsMode) return await reply("You cannot use this command when `fullPermsMode` is disabled.");
        if(!ctx.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(ctx.member.id)) {
            return await reply("no");
        }
        if(lockedData[ctx.channel.id]) {
            return await reply("This channel is already locked.");
        }
        var moderatorOverwriteExists = ctx.channel.permissionOverwrites.cache.some(o=>o.type==OverwriteType.Role&&o.id==config.moderatorRole);
        var botOverwriteExists = ctx.channel.permissionOverwrites.cache.some(o=>o.type==OverwriteType.Member&&o.id==client.user.id);
        var everyoneSendAllowed = ctx.channel.permissionOverwrites.cache.some(o=>o.type==OverwriteType.Role&&o.id==ctx.guild.roles.everyone.id&&o.allow.has(PermissionFlagsBits.SendMessages));
        var everyoneSendDenied = ctx.channel.permissionOverwrites.cache.some(o=>o.type==OverwriteType.Role&&o.id==ctx.guild.roles.everyone.id&&o.deny.has(PermissionFlagsBits.SendMessages));
        await ctx.channel.permissionOverwrites.edit(config.moderatorRole, {SendMessages:true});
        await ctx.channel.permissionOverwrites.edit(client.user.id, {SendMessages:true});
        await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone, {SendMessages:false});
        lockedData[ctx.channel.id] = {
            moderatorOverwriteExists,
            botOverwriteExists,
            everyoneState: null
        }
        if(everyoneSendAllowed) {
            lockedData[ctx.channel.id].everyoneState = true;
        } else if(everyoneSendDenied) {
            lockedData[ctx.channel.id].everyoneState = false;
        }
        fs.writeFileSync(lockedDataFile, JSON.stringify(lockedData, null, 2));
        let lockedEmbed = new EmbedBuilder();
        lockedEmbed.setTitle(":lock: This channel is now locked down.");
        lockedEmbed.setDescription(`Only users with <@&${config.moderatorRole}> or higher can speak. Do not bring the topic to other channels or you may face moderation action.`);
        lockedEmbed.setColor("Red");
        await reply({embeds:[lockedEmbed], allowedMentions: {roles:[]}});
    }

    async function unlockCmdHandler(isSlash, params, ctx) {
        if(isSlash) await ctx.deferReply();
        let reply = util.ctxReplier(ctx, isSlash);
        if(!config.fullPermsMode) return await reply("You cannot use this command when `fullPermsMode` is disabled.");
        if(!ctx.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(ctx.member.id)) {
            return await reply("no");
        }
        if(!lockedData[ctx.channel.id]) {
            return await reply("This channel is already unlocked.");
        }
        if(!lockedData[ctx.channel.id].moderatorOverwriteExists) {
            await ctx.channel.permissionOverwrites.delete(config.moderatorRole);
        }
        if(!lockedData[ctx.channel.id].botOverwriteExists) {
            await ctx.channel.permissionOverwrites.delete(client.user.id);
        }
        await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone, {SendMessages: lockedData[ctx.channel.id].everyoneState});
        delete lockedData[ctx.channel.id];
        fs.writeFileSync(lockedDataFile, JSON.stringify(lockedData, null, 2));
        let unlockedEmbed = new EmbedBuilder();
        unlockedEmbed.setTitle(":unlock: This channel is now unlocked.");
        unlockedEmbed.setColor("Blue");
        await reply({embeds: [unlockedEmbed]});
    }

    return {
        onReady,
        commands: {
            lock: {
                prefix: {
                    name: "lock",
                    params: []
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("lock")
                    .setDescription("Locks a channel so only moderators can send messages, Moderator+ only")
                    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                    .setContexts(InteractionContextType.Guild)
                },
                handler: lockCmdHandler
            },
            unlock: {
                prefix: {
                    name: "unlock",
                    params: []
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("unlock")
                    .setDescription("Unlocks a channel after it has been locked, Moderator+ only")
                    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                    .setContexts(InteractionContextType.Guild)
                },
                handler: unlockCmdHandler
            }
        }
    }
}