var util = require('./util');

module.exports = (client, logChannel, config) => {
    async function onCommand(command, args, message) {
        if(command == "onbreak") {
            await setBreak(message, true);
        } else if(command == "offbreak") {
            await setBreak(message, false);
        }
    }

    async function setBreak(message, value) {
        var user = message.member;
        if(!util.hasRole(user, config.breakRoleList)) {
            await message.reply("You don't seem to have any active staff roles.");
            return;
        }

        if(util.hasRole(user, config.onBreakRoleId) == value) {
            await message.reply(`You are already ${value?"on":"off"} break!`);
            return;
        }

        if(value) {
            await user.roles.add(config.onBreakRoleId);
            await message.reply("You are now on break. Take that needed time off, you deserve it.");
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