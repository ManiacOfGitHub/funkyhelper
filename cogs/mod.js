var {EmbedBuilder, Embed, SlashCommandBuilder, InteractionContextType, PermissionFlagsBits} = require("discord.js");
var util = require('../util');

var commandList = ['closeticketdm', 'ctdm'];
var ms = require('ms');

module.exports = (client, logChannels, config, botContext) => {
    async function onCommand(command, args, message) {
        if(!commandList.includes(command)) return;
        if(args < 2) {
            await message.channel.send("Not enough arguments.");
            return;
        }
        var userId;
        var user;
        try {
            userId = args[1].match(/\d+/).join("");
            user = await message.guild.members.fetch(userId);
            if(!user) throw Error();
        } catch(err) {
            await message.reply("Valid server member was not provided.");
            return;
        }
        if(util.hasRole(user, config.staffRoleList)) {
            await message.reply("FunkyHelper will not afflict any punishments upon staff, please do so manually.");
            return;
        }
    }

    async function banCmdHandler(isSlash, params, ctx, commandName) {
        if(isSlash) await ctx.deferReply();
        if(isSlash && parseInt(params.user)) {
            try {
                params.user = await client.users.fetch(params.user);
                if(!params.user) throw Error;
            } catch(err) {
                await reply("Valid user was not provided.");
                return;
            }
        }
        var reply = util.ctxReplier(ctx, isSlash);
        if(!modCheck(ctx.member)) return await reply("no");
        var member = await getMember(params.user);
        if(!member) {
            try {
                await botContext.guild.bans.create(params.user.id,{reason:params.reason||""});
            } catch(err) {
                await reply(`Server member was not found, unable to add user to ban list by ID.\nError info: ` + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }
            await funnyReply(reply, "User", "User was not found within the server, so they have been added to the ban list by ID. They have **not** been sent a DM.");
        } else {
            if(await staffCheck(member, reply)) return;
            try {
                let banEmbed = new EmbedBuilder();
                banEmbed.setTitle("Moderation Action");
                banEmbed.setDescription(`**You have been banned from ${botContext.guild.name}.**\n**${params.reason ? ("Reason: " + params.reason) : "No reason was provided."}**\nIf you would like to appeal, email staff@funkyscott47.com with the following:\n* Why you think you should be unbanned\n* What rules you violated (if any)\nPlease do not spam, it may take a few days to respond.`);
                banEmbed.setColor("DarkRed");
                await member.send({embeds: [banEmbed]});
                await logChannels.important.send("DM succeeded!");
            } catch(err) {
                await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
            }
            try {
                await member.ban({reason: params.reason});
            } catch(err) {
                await reply("Failed to ban member.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }
            await funnyReply(reply, member.user.username, "Ban successful.");
        }
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to ban a user`);
        logEmbed.setAuthor({name:ctx.member.user.username, iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Banned ${member?member.user.username:"a user"} (user ID: ${params.user.id}) from the server with the following reason:\n${params.reason || "No reason was provided."}${!member?"\nThis user was not found within the server, so they have been added to the ban list by ID. They have **not** been sent a DM.":""}`);
        logEmbed.setFooter({text:"ID: " + params.user.id});
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function unbanCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) {
            await ctx.deferReply();
            try {
                params.user = await client.users.fetch(params.user);
                if(!params.user) throw Error;
            } catch(err) {
                await reply("Valid user was not provided.");
                return;
            }
        }
        if(!modCheck(ctx.member)) return await reply("no");
        if(await getMember(params.user)) return await reply("The user is already in the server.");
        try {
            await botContext.guild.bans.remove(params.user.id,{reason:params.reason});
        } catch(err) {
            await reply(`Unable to remove user from ban list by ID.\nError info: ` + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }
        await reply("User removed from ban list.");
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to unban a user`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Unbanned a user (user ID: ${params.user.id}) from the server with the following reason:\n${params.reason?("Reason: " + params.reason):"No reason was provided."}`);
        logEmbed.setFooter({text:"ID: " + params.user.id});
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function timeoutCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");
        if(await staffCheck(member, reply)) return;
        try {
            var timeoutTime = ms(params.duration);
            if(!Number.isFinite(timeoutTime)) {
                await reply("Invalid (or no) time specified.");
                return;
            }
            if(timeoutTime < 1000) {
                timeoutTime *= 1000;
            }
            if(timeoutTime < ms('5s')) {
                await reply("Time cannot be shorter than 5 seconds");
                return;
            }
            if(timeoutTime > ms('28d')) {
                await reply("Time cannot be longer than 28 days.");
                return;
            }
        } catch(err) {
            await reply("Invalid (or no) time specified.");
            return;
        }

        try {
            await member.timeout(timeoutTime, params.reason);
        } catch(err) {
            await reply("Failed to time out member.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        try {
            await member.fetch();
            let timeoutEmbed = new EmbedBuilder();
            timeoutEmbed.setTitle("Moderation Action");
            timeoutEmbed.setDescription(`**You have been timed out in ${botContext.guild.name} for ${ms(timeoutTime, {long: true})}.**\n**${params.reason?("Reason: " + params.reason):"No reason was provided."}**\nYou will be able to speak in the server on <t:${~~(member.communicationDisabledUntilTimestamp/1000)}:f>.`);
            timeoutEmbed.setColor("DarkRed");
            await member.send({embeds: [timeoutEmbed]});
            await logChannels.important.send("DM succeeded!");
        } catch(err) {
            await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
        }
        
        await funnyReply(reply, member.user.username, "Timeout successful.");
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to time out a user.`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Timed out ${member.user.username} (user ID: ${member.id}) for ${ms(timeoutTime, {long: true})}. ${params.reason?("Reason: " + params.reason):"No reason was provided."}`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
        return;
    }

    async function untimeoutCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");

        try {
            await member.timeout(null, params.reason);
        } catch(err) {
            await reply("Failed to remove time out from member.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        try {
            await member.fetch();
            let timeoutEmbed = new EmbedBuilder();
            timeoutEmbed.setTitle("Moderation Action");
            timeoutEmbed.setDescription(`**Good news! You have been untimed out in ${botContext.guild.name}!**\n**${params.reason?("Reason: " + params.reason):"No reason was provided."}**\nWelcome back to the server!`);
            timeoutEmbed.setColor("Green");
            await member.send({embeds: [timeoutEmbed]});
            await logChannels.important.send("DM succeeded!");
        } catch(err) {
            await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
        }

        await reply("User's timeout was removed.");
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to remove a timeout from a user.`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Untimed out ${member.user.username} (user ID: ${member.id}). ${params.reason?("Reason: " + params.reason):"No reason was provided."}`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
        return;
    }

    async function scamKickCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        var userId = member.id;
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");
        if(await staffCheck(member, reply)) return;
        try {
            let scamKickedEmbed = new EmbedBuilder();
            scamKickedEmbed.setTitle("Suspicious Activity");
            scamKickedEmbed.setDescription("You have been kicked from " + botContext.guild.name + " due to messages that seem to be created by a bot that has hijacked your account. Once you have verified that your account is back under your control, you can rejoin [here](https://discord.gg/eVQkMaTQw2).");
            scamKickedEmbed.setColor("DarkRed");
            await member.send({embeds: [scamKickedEmbed]});
            await logChannels.important.send("DM succeeded!");
        } catch(err) {
            await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
        }

        try {
            await logChannels.important.send("Attempting to ban user (temporarily in order to remove messages)...");
            await member.ban({deleteMessageSeconds: 60 * 60 * 24, reason: commandStr(commandName, isSlash) + " run by "+ctx.member.user.username});
        } catch(err) {
            await logChannels.important.send(`<@&${config.activeModeratorsId}> Warning! ${member} was unable to be banned!\nReason: ` + (err?(err.message??"syke lmao"):"syke lmao"));
            await reply(`Failed to ban user, please check <#${logChannels.important.id}>`);
            return;
        }

        await logChannels.important.send("Ban succeeded. Attempting to unban user...");
        try {
            await botContext.guild.bans.remove(userId);
            await logChannels.important.send("Unban succeeded.");
        } catch(err) {
            await logChannels.important.send(`<@&${config.activeModeratorsId}> Warning! ${member} was unable to be unbanned! Please ensure that user is able to rejoin server.\nReason: ` + (err?(err.message??"syke lmao"):"syke lmao"));
            await reply(`Failed to unban user, please check <#${logChannels.important.id}>`);
        }
        await funnyReply(reply, member.user.username, "Scammer Kicked.");
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to scam kick a user`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Scam kicked ${member.user.username} (user ID: ${userId}) from the server.`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function kickCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        var userId = member.id;
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");
        if(await staffCheck(member, reply)) return;
        try {
            let kickedEmbed = new EmbedBuilder();
            kickedEmbed.setTitle("Moderation Action");
            kickedEmbed.setDescription(`**You have been kicked from ${botContext.guild.name}.**\n**${params.reason?("Reason: " + params.reason):"No reason was provided."}**\nYou can rejoin the server.`);
            kickedEmbed.setColor("DarkRed");
            await member.send({embeds: [kickedEmbed]});
            await logChannels.important.send("DM succeeded!");
        } catch(err) {
            await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
        }

        try {
            await member.kick({reason: params.reason});
        } catch(err) {
            await reply("Failed to kick member.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        await funnyReply(reply, member.user.username, "Kick successful.");
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to kick a user`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Kicked ${member.user.username} (user ID: ${userId}) from the server.`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function noHelpCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        var userId = member.id;
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");
        if(await staffCheck(member, reply)) return;
        try {
            var appealsChannel = await botContext.guild.channels.fetch(config.appealsChannelId);
            let noHelpEmbed = new EmbedBuilder();
            noHelpEmbed.setTitle("Moderation Action");
            noHelpEmbed.setDescription(`**You have lost help channel privleges in ${botContext.guild.name}.**\n**${params.reason?("Reason: " + params.reason):"No reason was provided."}**\nYou can appeal in the ${appealsChannel.url} channel.`);
            noHelpEmbed.setColor("DarkRed");
            await member.send({embeds: [noHelpEmbed]});
            await logChannels.important.send("DM succeeded!");
        } catch(err) {
            await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
        }

        try {
            await member.roles.add(config.noHelpRoleId);
        } catch(err) {
            await reply("Failed to add restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        await funnyReply(reply, member.user.username, "User lost access to help channels.");
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to remove help channel access from a user`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Gave nohelp role to ${member.user.username} (user ID: ${userId}).\n${params.reason?("Reason: " + params.reason):"No reason was provided."}`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function yesHelpCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        var userId = member.id;
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");

        try {
            await member.roles.remove(config.noHelpRoleId);
        } catch(err) {
            await reply("Failed to remove restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        await reply("User is now free as a bird.");
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to give help channel back to a user`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Removed nohelp role from ${member.user.username} (user ID: ${userId}).`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function appealMuteCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        var userId = member.id;
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");

        try {
            await member.roles.add(config.appealMuteRoleId);
        } catch(err) {
            await reply("Failed to add restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        await reply(`${member.user.username} can no longer speak in <#${config.appealsChannelId}>.`);
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to mute a user in <#${config.appealsChannelId}>`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Gave appealmute role to ${member.user.username} (user ID: ${userId}).`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function appealUnmuteCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        var userId = member.id;
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");

        try {
            await member.roles.remove(config.appealMuteRoleId);
        } catch(err) {
            await reply("Failed to remove restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        await reply(`${member.user.username} can now speak in <#${config.appealsChannelId}>.`);
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to unmute a user in <#${config.appealsChannelId}>`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Removed appealmute role from ${member.user.username} (user ID: ${userId}).`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function modPingMuteCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        var userId = member.id;
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");

        try {
            await member.roles.add(config.modPingMuteRoleId);
        } catch(err) {
            await reply("Failed to add restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        await reply({content:`${member.user.username} can no longer ping <@&${config.activeModeratorsId}> with \`/modping\`.`,allowedMentions:{parse:[]}});
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to mod ping mute a user.`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Gave modpingmute role to ${member.user.username} (user ID: ${userId}).`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function modPingUnmuteCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        var userId = member.id;
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");

        try {
            await member.roles.remove(config.modPingMuteRoleId);
        } catch(err) {
            await reply("Failed to remove restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            return;
        }

        await reply({content:`${member.user.username} can now ping <@&${config.activeModeratorsId}> with \`/modping\`.`, allowedMentions: {parse: []}});
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${commandStr(commandName, isSlash)} was used to give \`/modping\` access back to a user.`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(`Removed modpingmute role from ${member.user.username} (user ID: ${userId}).`);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }
    
    async function ctdmCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        if(!member) return await reply("Valid member was not provided.");
        if(!helperCheck(ctx.member)) return await reply("no");

        try {
            await member.fetch();
            let ticketClosedEmbed = new EmbedBuilder();
            let reason = params.reason;
            if(reason == "hbhelp") {
                reason = "Tickets are not to be used for homebrew assistance. Please ask in #help-general or a different relevant help channel and be patient.";
            }
            ticketClosedEmbed.setTitle(`Your ticket has been closed.`);
            ticketClosedEmbed.setDescription(`A ticket that you opened was closed for the following reason: ${reason||"No reason was provided."}`);
            await member.send({embeds:[ticketClosedEmbed]});
            await reply("DM successful!");
        } catch(err) {
            await reply("User could not be DM'd.")
        }
    }

    async function getMember(user) {
        try {
            var member = await botContext.guild.members.fetch(user);
            return member;
        } catch(err) {
            return false;
        }
    }

    async function staffCheck(member, reply) {
        if(util.hasRole(member, config.staffRoleList)) {
            await reply("FunkyHelper will not afflict any punishments upon staff, please do so manually.");
            return true;
        }
    }
    
    function modCheck(member) {
        if(!member) return false;
        return member.roles.cache.some(role=>role.id==config.moderatorRole) || config.botOwners.includes(member.id);
    }

    function helperCheck(member) {
        if(!member) return false;
        return util.hasRole(member, config.helperPlusRoleList) || config.botOwners.includes(member.id);
    }

    async function funnyReply(reply, username, info) {
        var funnyOptions = config.funnyOptions;
        await reply(`${username}${funnyOptions[~~(Math.random() * funnyOptions.length)]}\n-# ${info}`);
    }

    function commandStr(commandName, isSlash) {
        return `${isSlash?"/":"."}${commandName}`;
    }

    return {
        onCommand,
        commandList,
        commands: {
            ban: {
                prefix: {
                    name: "ban",
                    aliases: ["yeet"],
                    params: [
                        {
                            name: "user",
                            type: "user"
                        },
                        {
                            name: "reason",
                            type: "longtext",
                            optional: true
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("ban")
                    .setDescription("Bans a member, Moderator+ only, aka yeet")
                    .addUserOption(option=> option.setName("user").setDescription("Choose a member within the server, or paste a user ID here.").setRequired(true))
                    .addStringOption(option=> option.setName("reason").setDescription("Optional reason to ban this user"))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                },
                handler: banCmdHandler
            },
            unban: {
                prefix: {
                    name: "unban",
                    aliases: ["unyeet"],
                    params: [
                        {
                            name: "user",
                            type: "user"
                        },
                        {
                            name: "reason",
                            type: "longtext",
                            optional: true
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("unban")
                    .setDescription("Unbans a user, Moderator+ only, aka unyeet")
                    .addStringOption(option=> option.setName("user").setDescription("The user ID").setRequired(true))
                    .addStringOption(option=> option.setName("reason").setDescription("Optional reason to unban this user"))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                },
                handler: unbanCmdHandler
            },
            timeout: {
                prefix: {
                    name: "timeout",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        },
                        {
                            name: "duration",
                            type: "text"
                        },
                        {
                            name: "reason",
                            type: "longtext",
                            optional: true
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("timeout")
                    .setDescription("Times out a member, Helper+ only")
                    .addUserOption(option=>option.setName("member").setDescription("The member to time out").setRequired(true))
                    .addStringOption(option=>option.setName("duration").setDescription("How long they should be timed out for").setRequired(true))
                    .addStringOption(option=>option.setName("reason").setDescription("Optional reason to timeout this user"))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: timeoutCmdHandler
            },
            untimeout: {
                prefix: {
                    name: "untimeout",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        },
                        {
                            name: "reason",
                            type: "longtext",
                            optional: true
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("untimeout")
                    .setDescription("Untimes out a member, Helper+ only")
                    .addUserOption(option=>option.setName("member").setDescription("The member to untime out").setRequired(true))
                    .addStringOption(option=>option.setName("reason").setDescription("Optional reason to timeout this user"))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: untimeoutCmdHandler
            },
            scamkick: {
                prefix: {
                    name: "scamkick",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("scamkick")
                    .setDescription("Kicks members and deletes 1 hour of messages, Helper+ only")
                    .addUserOption(option=>option.setName("member").setDescription("The member to scam kick").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: scamKickCmdHandler
            },
            kick: {
                prefix: {
                    name: "kick",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        },
                        {
                            name: "reason",
                            type: "longtext",
                            optional: true
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("kick")
                    .setDescription("Kicks a member, Helper+ only")
                    .addUserOption(option=> option.setName("member").setDescription("Choose a member within the server").setRequired(true))
                    .addStringOption(option=> option.setName("reason").setDescription("Optional reason to kick this user"))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: kickCmdHandler
            },
            nohelp: {
                prefix: {
                    name: "nohelp",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        },
                        {
                            name: "reason",
                            type: "longtext",
                            optional: true
                        }
                    ],
                    aliases: ["takehelp"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("nohelp")
                    .setDescription("Removes access to assistance channel for member, Helper+ only, aka takehelp")
                    .addUserOption(option=> option.setName("member").setDescription("Choose a member within the server").setRequired(true))
                    .addStringOption(option=> option.setName("reason").setDescription("Optional reason to remove access"))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: noHelpCmdHandler
            },
            yeshelp: {
                prefix: {
                    name: "yeshelp",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        }
                    ],
                    aliases: ["givehelp"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("yeshelp")
                    .setDescription("Gives access back to nohelped member, Helper+ only, aka givehelp")
                    .addUserOption(option=> option.setName("member").setDescription("Choose a member within the server").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: yesHelpCmdHandler
            },
            appealmute: {
                prefix: {
                    name: "appealmute",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        }
                    ],
                    aliases: ["appealsmute"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("appealmute")
                    .setDescription("Makes member no longer able to speak in #appeals, Helper+ only")
                    .addUserOption(option=> option.setName("member").setDescription("Choose a member within the server").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: appealMuteCmdHandler
            },
            appealunmute: {
                prefix: {
                    name: "appealunmute",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        }
                    ],
                    aliases: ["appealsunmute"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("appealunmute")
                    .setDescription("Allow appealmuted member to speak in #appeals, Helper+ only")
                    .addUserOption(option=> option.setName("member").setDescription("Choose a member within the server").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: appealUnmuteCmdHandler
            },
            modpingmute: {
                prefix: {
                    name: "modpingmute",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        }
                    ],
                    aliases: ["pingmodmute"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("modpingmute")
                    .setDescription("Stop member from using /modping, Helper+ only")
                    .addUserOption(option=> option.setName("member").setDescription("Choose a member within the server").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: modPingMuteCmdHandler
            },
            modpingunmute: {
                prefix: {
                    name: "modpingunmute",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        }
                    ],
                    aliases: ["pingmodunmute"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("modpingunmute")
                    .setDescription("Allows modpingmuted member to use /modping, Helper+ only")
                    .addUserOption(option=> option.setName("member").setDescription("Choose a member within the server").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: modPingUnmuteCmdHandler
            },
            closeticketdm: {
                prefix: {
                    name: "closeticketdm",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        },
                        {
                            name: "reason",
                            type: "longtext",
                            optional: true
                        }
                    ],
                    aliases: ["ctdm"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("closeticketdm")
                    .setDescription("DMs user with reason why ticket was closed, does not close ticket, Helper+ only, aka ctdm")
                    .addUserOption(option=> option.setName("member").setDescription("Choose a member within the server").setRequired(true))
                    .addStringOption(option=> option.setName("reason").setDescription("Reason why ticket was closed, use \"hbhelp\" if they were asking for homebrew help."))
                },
                handler: ctdmCmdHandler
            }
        }
    };
}
