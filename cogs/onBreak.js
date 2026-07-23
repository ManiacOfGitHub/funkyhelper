var util = require('../util');
const { MessageFlags } = require('discord.js');
var commandList = ["onbreak", "offbreak", "roleon", "roleoff"]

module.exports = (client, logChannels, config) => {
    async function onCommand(command, args, message) {
        if(!commandList.includes(command)) return;
        if(!util.hasRole(message.member, config.breakRoleList)) {
            await message.reply("You don't seem to have any active staff roles.");
            return;
        }
        if(command == "onbreak") {
            await setBreak(message, true, args);
        } else if(command == "offbreak") {
            await setBreak(message, false, args);
        } else if(command == "roleon") {
            await setCosmetics(message.member, true);
            await message.reply("Your cosmetic roles are back! You got fancy schmancy colors now.");
        } else if(command == "roleoff") {
            await setCosmetics(message.member, false);
            await message.reply("You are now a ghost... ooooooooo spooooky.");
        }
    }

    async function setBreak(message, value, args) {
        var user = message.member;
        if(util.hasRole(user, config.onBreakRoleId) == value) {
            await message.reply(`You are already ${value?"on":"off"} break!`);
            return;
        }
        if(value && args.length < 2) {
            await message.reply(`You must supply a reason to go on break.\nUsage: .onbreak <reason>`);
            return;
        }
        if(args[1]=="test") {
            await message.reply(`You have run this command in test mode. You passed all previous checks, so if you had not run it in test mode, you would now be ${value?"on":"off"} break.`);
            return;
        }
        await setCosmetics(user, !value);
        if(value) {
            await user.roles.add(config.onBreakRoleId);
            await message.reply("You are now on break. Take that needed time off, you deserve it.");
            await logChannels.important.send({content:`<@&${config.activeModeratorsId}> ${user} is now on break.\nReason: ${args.slice(1).join(" ")}`,flags: [MessageFlags.SuppressNotifications],allowedMentions:{parse:['roles']}});
            return;
        } else {
            await user.roles.remove(config.onBreakRoleId);
            await message.reply("You are now off break. Stay Funky and Happy Modding!");
            await logChannels.important.send({content:`${user} is now off break.\nReason: ${args.length>1?args.slice(1).join(" "):"Not provided"}`,allowedMentions:{parse:[]}});
            return;
        }
       
    }

    async function setCosmetics(user, value) {
        if(!value) {
            await user.roles.remove(Object.values(config.cosmeticRoleMap));
            return;
        }
        for(var staffRole in config.cosmeticRoleMap) {
            if(util.hasRole(user, staffRole)) {
                await user.roles.add(config.cosmeticRoleMap[staffRole]);
            }
        }
    }

    return {
        onCommand,
        commandList
    }
}
