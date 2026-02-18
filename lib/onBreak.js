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
        for(let adminLevel of config.breakRoles) {
            if(!util.hasRole(user, adminLevel[0])) continue;
            if(util.hasRole(user, adminLevel[1]) == value) {
                await message.reply(`You are already ${value?"on":"off"} break!`);
                return;
            }

            if(value) {
                await user.roles.add(adminLevel[1]);
                await message.reply("You are now on break. Take that needed time off, you deserve it.");
                return;
            } else {
                await user.roles.remove(adminLevel[1]);
                await message.reply("You are now off break. Stay Funky and Happy Modding!");
                return;
            }
        }
        await message.reply("You don't seem to have any staff roles with a break role.");
    }

    return {
        onCommand
    }
}