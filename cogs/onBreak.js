var util = require('../util');
const { MessageFlags, SlashCommandBuilder, InteractionContextType } = require('discord.js');

module.exports = (client, logChannels, config) => {
    async function setBreak(user, value, reason, reply) {
        if(util.hasRole(user, config.onBreakRoleId) == value) {
            await reply(`You are already ${value?"on":"off"} break!`);
            return;
        }
        if(value) {
            await reply("You are now on break. Take that needed time off, you deserve it.");
            await user.roles.add(config.onBreakRoleId);
            await logChannels.important.send({content:`<@&${config.activeModeratorsId}> ${user} is now on break.\nReason: ${reason}`,flags: [MessageFlags.SuppressNotifications],allowedMentions:{parse:['roles']}});
        } else {
            await reply("You are now off break. Stay Funky and Happy Modding!");
            await user.roles.remove(config.onBreakRoleId);
            await logChannels.important.send({content:`${user} is now off break.\nReason: ${reason?reason:"Not provided"}`,allowedMentions:{parse:[]}});
        }
        await setCosmetics(user, !value);
    }

    async function setCosmetics(user, value) {
        if(!value) {
            for(var staffRole in config.cosmeticRoleMap) {
                await user.roles.remove(config.cosmeticRoleMap[staffRole]);
            }            
            return;
        }
        for(var staffRole in config.cosmeticRoleMap) {
            if(util.hasRole(user, staffRole)) {
                await user.roles.add(config.cosmeticRoleMap[staffRole]);
            }
        }
    }

    async function notStaffCheck(ctx, isSlash) {
        if(!util.hasRole(ctx.member, config.breakRoleList)) {
            await ctx.reply("You don't seem to have any active staff roles.");
            return true;
        }
        if(isSlash) await ctx.deferReply();
        return false;
    }

    async function onBreakCmdHandler(isSlash, params, ctx) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(await notStaffCheck(ctx, isSlash)) return;
        await setBreak(ctx.member, true, params.reason, reply);
    }

    async function offBreakCmdHandler(isSlash, params, ctx) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(await notStaffCheck(ctx, isSlash)) return;
        await setBreak(ctx.member, false, params.reason, reply);
    }

    async function roleOnCmdHandler(isSlash, params, ctx) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(await notStaffCheck(ctx, isSlash)) return;
        await setCosmetics(ctx.member, true);
        await reply("Your cosmetic roles are back! You got fancy schmancy colors now.");
    }

    async function roleOffCmdHandler(isSlash, params, ctx) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(await notStaffCheck(ctx, isSlash)) return;
        await setCosmetics(ctx.member, false);
        await reply("You are now a ghost... ooooooooo spooooky.");
    }

    return {
        commands: {
            onbreak: {
                prefix: {
                    name: "onbreak",
                    params: [
                        {
                            name: "reason",
                            type: "longtext"
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("onbreak")
                    .setDescription("Gives staff members a role to show they are on break")
                    .addStringOption(option=>option.setName("reason").setDescription("Required reason to go on break").setRequired(true))
                    .setContexts(InteractionContextType.Guild)
                },
                handler: onBreakCmdHandler
            },
            offbreak: {
                prefix: {
                    name: "offbreak",
                    params: [
                        {
                            name: "reason",
                            type: "longtext",
                            optional: true
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("offbreak")
                    .setDescription("Removes the on break role from staff members")
                    .addStringOption(option=>option.setName("reason").setDescription("Optional reason to go off break"))
                    .setContexts(InteractionContextType.Guild)
                },
                handler: offBreakCmdHandler
            },
            roleon: {
                prefix: {
                    name: "roleon",
                    params: []
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("roleon")
                    .setDescription("Gives staff members their cosmetic roles so they can be easily seen in the user list")
                    .setContexts(InteractionContextType.Guild)
                },
                handler: roleOnCmdHandler
            },
            roleoff: {
                prefix: {
                    name: "roleoff",
                    params: []
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("roleoff")
                    .setDescription("Removes staff members' cosmetic roles so they cannot be easily seen in the user list")
                    .setContexts(InteractionContextType.Guild)
                },
                handler: roleOffCmdHandler
            }
        }
    }
}
