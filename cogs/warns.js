const { SlashCommandBuilder, InteractionContextType, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
var cron = require('node-cron');
var util = require("../util");
var ms = require('ms');
var getUserWarns, getWarn, createWarn, deleteWarn;
module.exports = (client, logChannels, config, botContext) => {
    async function onReady() {
        db = botContext.db;
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_warns (
                warn_id INTEGER PRIMARY KEY,
                discord_id INTEGER NOT NULL,
                time_received INTEGER NOT NULL,
                permanent BOOLEAN NOT NULL DEFAULT 0,
                reason TEXT NOT NULL
            );
        `);
        getUserWarns = db.prepare(`
            SELECT *,CAST(discord_id AS varchar) AS discord_id FROM user_warns WHERE discord_id = ?;
        `);
        getWarn = db.prepare(`
            SELECT *,CAST(discord_id AS varchar) AS discord_id from user_warns WHERE warn_id = ?;
        `);
        createWarn = db.prepare(`
            INSERT INTO user_warns (discord_id, time_received, reason) VALUES (?, ?, ?);
        `);
        deleteWarn = db.prepare(`
            DELETE FROM user_warns WHERE warn_id = ?;
        `);
        if(config.warnExpiry) cron.schedule('* * * * *', checkWarnExpiry);
    }

    async function checkWarnExpiry() {
        var timeToCheck = Date.now()-ms(config.warnExpiry);
        var warnsToDelete = db.prepare(`
            SELECT *,CAST(discord_id AS varchar) AS discord_id FROM user_warns WHERE permanent = 0 AND time_received <= ?;
        `).all(timeToCheck);
        if(!warnsToDelete.length) return;
        warnsToDelete = warnsToDelete.map(data=>`Warn ID ${data.warn_id} given to <@${data.discord_id}> on <t:${~~(data.time_received/1000)}:f>\n${data.reason}`);
        await logChannels.important.send(`The following warns are now expiring:\n\n${warnsToDelete.join("\n\n")}`);
        db.prepare(`
            DELETE FROM user_warns WHERE permanent = 0 AND time_received <= ?;
        `).run(timeToCheck);
    }

    async function warnCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member = await getMember(params.member);
        if(!member) return await reply("Valid member was not provided.");
        var userId = member.id;
        if(!helperCheck(ctx.member)) return await reply("no");
        if(await staffCheck(member)) {
            if(!modCheck(ctx.member)) {
                return await reply("You cannot warn a staff member unless you are a Moderator.");
            }
            if(modCheck(member)) {
                if(!config.botOwners.includes(ctx.member.id)) {
                    return await reply("You cannot warn a Moderator or a Bot Owner unless you are a Bot Owner.");
                }
            }
        }

        createWarn.run(userId, Date.now(), params.reason);
        var numWarns = getUserWarns.all(userId).length;
        var punishmentInfo = "";
        for(var punishmentData of config.warnPunishments) {
            if(numWarns >= punishmentData[0]) {
                if(await staffCheck(member)) {
                    punishmentInfo = "Due to having " + punishmentData[0] + "+ warns, if this user was not a staff member, they would now be ";
                } else {
                    punishmentInfo = "Due to having " + punishmentData[0] + "+ warns, this user has now been ";
                }
                if(punishmentData[1] == "ban") punishmentInfo += "banned.";
                if(punishmentData[1] == "kick") punishmentInfo += "kicked.";
                if(await staffCheck(member)) break;
                if(punishmentData[1] == "ban") {
                    try {
                        let banEmbed = new EmbedBuilder();
                        banEmbed.setTitle("Moderation Action");
                        banEmbed.setDescription(`**You have been banned from ${botContext.guild.name} after getting too many warnings.**\n**Reason for latest warning: ${params.reason}**\nIf you would like to appeal, email staff@funkyscott47.com with the following:\n* Why you think you should be unbanned\n* What rules you violated (if any)\nPlease do not spam, it may take a few days to respond.`);
                        banEmbed.setColor("DarkRed");
                        await member.send({embeds: [banEmbed]});
                        await logChannels.important.send("DM succeeded!");
                    } catch(err) {
                        await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
                    }
                    try {
                        await member.ban({reason: "Reached " + numWarns + " warns"});
                    } catch(err) {
                        await reply("Failed to ban member after adding warn number " + numWarns + ".\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                        return;
                    }
                    
                } else if(punishmentData[1] == "kick") {
                    try {
                        let kickedEmbed = new EmbedBuilder();
                        kickedEmbed.setTitle("Moderation Action");
                        kickedEmbed.setDescription(`**You have been kicked from ${botContext.guild.name} after getting too many warnings.**\n**Reason for latest warning: ${params.reason}**\nYou can rejoin the server.`);
                        kickedEmbed.setColor("DarkRed");
                        await member.send({embeds: [kickedEmbed]});
                        await logChannels.important.send("DM succeeded!");
                    } catch(err) {
                        await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
                    }
                    try {
                        await member.kick("Reached " + numWarns + " warns");
                    } catch(err) {
                        await reply("Failed to kick member after adding warn number " + numWarns + ".\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                        return;
                    }
                }
                break;
            }
        }
        var msg = `${member} was warned. User now has ${numWarns} warn${numWarns!=1?"s":""}.${isSlash ? ("\nReason: " + params.reason) : ""}${punishmentInfo?"\n"+punishmentInfo:""}`;
        await reply(msg);
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${util.commandStr(commandName, isSlash)} was used to warn a user`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(msg);
        logEmbed.setTimestamp();
        await logChannels.important.send({content:punishmentInfo?`<@&${config.activeModeratorsId}>`:"",embeds: [logEmbed],allowedMentions:{parse:[],roles:[config.activeModeratorsId]}});
    }

    async function listWarnsCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        var member;
        if(!params.user) {
            member = ctx.member;
            userId = member.id;
        } else {
            var member = await getMember(params.user);
            if(member) {
                userId = member.id;
            } else if(params.user.id) {
                userId = params.user.id;
            } else {
                userId = params.user;
            }
        }

        var userWarns = getUserWarns.all(userId);
        if(userWarns.length < 1) {
            await reply({content:`${member?member:"User with ID `" + userId + "`"} has no warnings. Let's keep it that way, shall we?`,allowedMentions:{parse:[]}});
            return;
        }
        userWarns = userWarns.map((data,i)=>`**#${(+i)+1}:** On <t:${~~(data.time_received/1000)}:f>\n${data.reason}\n-# Warn ID: ${data.warn_id}`);
        await reply({content:`${member?member:"User with ID `" + userId + "`"} has ${userWarns.length} warning${userWarns.length!=1?"s":""}.\n\n${userWarns.join("\n\n")}`,allowedMentions:{parse:[]}});
    }

    async function delWarnCmdHandler(isSlash, params, ctx, commandName) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        if(!helperCheck(ctx.member)) return await reply("no");
        var warnInfo = getWarn.get(+(params.warning));
        if(!warnInfo) return await reply("Valid warn ID was not provided.");


        var member = await getMember(warnInfo.discord_id);
        if(member) {
            if(staffCheck(member)) {
                if(!modCheck(ctx.member)) {
                    return await reply("You cannot delete a staff member's warn unless you are a Moderator.");
                }
                if(modCheck(member)) {
                    if(!config.botOwners.includes(ctx.member.id)) {
                        return await reply("You cannot delete a Moderator's warn or a Bot Owner's warn unless you are a Bot Owner.");
                    }
                }
            }
        }

        deleteWarn.run(+(params.warning));
        var msg = `Deleted warn ${params.warning} for <@${warnInfo.discord_id}> that was issued on <t:${~~(warnInfo.time_received/1000)}:f>\n${warnInfo.reason}`;
        await reply(msg);
        let logEmbed = new EmbedBuilder();
        logEmbed.setTitle(`${util.commandStr(commandName, isSlash)} was used to delete a user's warning`);
        logEmbed.setAuthor({name:ctx.member.user.username,iconURL:ctx.member.displayAvatarURL({extension:"png",size:2048})});
        logEmbed.setDescription(msg);
        logEmbed.setTimestamp();
        await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
    }

    async function staffCheck(member, reply) {
        if(util.hasRole(member, config.staffRoleList)) {
            return true;
        }
    }
    function helperCheck(member) {
        if(!member) return false;
        return util.hasRole(member, config.helperPlusRoleList) || config.botOwners.includes(member.id);
    }
    function modCheck(member) {
        if(!member) return false;
        return member.roles.cache.some(role=>role.id==config.moderatorRole) || config.botOwners.includes(member.id);
    }

    async function getMember(user) {
        try {
            var member = await botContext.guild.members.fetch(user);
            return member;
        } catch(err) {
            return false;
        }
    }
    return {
        commands: {
            warn: {
                prefix: {
                    name: "warn",
                    params: [
                        {
                            name: "member",
                            type: "member"
                        },
                        {
                            name: "reason",
                            type: "longtext"
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("warn")
                    .setDescription("Warns a user and adds it to the database, Helper+ only")
                    .addUserOption(option=>option.setName("member").setDescription("The member to warn").setRequired(true))
                    .addStringOption(option=>option.setName("reason").setDescription("Reason that this user is getting warned").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: warnCmdHandler
            },
            listwarns: {
                prefix: {
                    name: "listwarns",
                    params: [
                        {
                            name: "user",
                            type: "user",
                            optional: true
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("listwarns")
                    .setDescription("Get list of warns of user")
                    .addUserOption(option=>option.setName("user").setDescription("Choose a member within the server, or paste a user ID here."))
                    .setContexts(InteractionContextType.Guild)
                },
                handler: listWarnsCmdHandler
            },
            delwarn: {
                prefix: {
                    name: "delwarn",
                    aliases: ["deletewarn"],
                    params: [
                        {
                            name: "warning",
                            type: "text"
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("delwarn")
                    .setDescription("Delete a warn, Helper+ only")
                    .addIntegerOption(option=>option.setName("warning").setDescription("Input the warn ID listed in /listwarns").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                },
                handler: delWarnCmdHandler
            }
        },
        onReady
    };
}