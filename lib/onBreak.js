var util = require('./util');

module.exports = (client, logChannel, config) => {
    async function onCommand(command, args, message) {
        if(command == "onbreak") {
            await setBreak(message, true, args);
        } else if(command == "offbreak") {
            await setBreak(message, false, args);
        }
    }

    async function setBreak(message, value, args) {
        var user = message.member;
        if(!util.hasRole(user, config.breakRoleList)) {
            await message.reply("You don't seem to have any active staff roles.");
            return;
        }

        if(util.hasRole(user, config.onBreakRoleId) == value) {
            await message.reply(`You are already ${value?"on":"off"} break!`);
            return;
        }
        if(args[1]=="test") {
            await message.reply(`You have run this command in test mode. You passed all previous checks, so if you had not run it in test mode, you would now be ${value?"on":"off"} break.`);
            return;
        }
        if(value) {
            await user.roles.add(config.onBreakRoleId);
            await message.reply("You are now on break. Take that needed time off, you deserve it.");
            try {
                let channel = await message.guild.channels.fetch(config.modChatChannelId);
                await channel.send(`<@&${config.activeModeratorsId}> ${user} is now on break.`);
            } catch(err) {
                await logChannel.send(`<@&${config.activeModeratorsId}> ${user} is now on break. (Unable to send this in <#${config.modChatChannelId}> for some reason?)`);
            }
            return;
        } else {
            await user.roles.remove(config.onBreakRoleId);
            await message.reply("You are now off break. Stay Funky and Happy Modding!");
            return;
        }
       
    }

    return {
        onCommand
    }
}