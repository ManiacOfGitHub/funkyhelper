var {EmbedBuilder} = require("discord.js");
var util = require('./util');

module.exports = (client, logChannel, config, havePermission) => {
    async function onCommand(command, args, message) {
        if(command=="ban") {
            if(!config.fullPermsMode) {
                await message.channel.send("You cannot use this command when `fullPermsMode` is disabled.");
                return;
            }
            if(!message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            if(args < 2) {
                await message.channel.send("Not enough arguments. Usage: .ban <member>");
                return;
            }
            var userId = args[1].match(/\d+/).join("");
            var user;
            try {
                user = await message.guild.members.fetch(userId);
                if(!user) throw Error();
            } catch(err) {
                await message.reply("Valid server member was not provided.");
                return;
            }
            if(util.hasRole(user, config.staffRoleList)) {
                await message.reply("FunkyHelper does not have permission to ban staff, please do so manually.");
                return;
            }

            try {
                let banEmbed = new EmbedBuilder();
                banEmbed.setTitle("Moderation Action");
                banEmbed.setDescription(`**You have been banned from ${message.guild.name}.**\n**${args.length>2?("Reason: " + args.slice(2).join(" ")):"No reason was provided."}**\nWe currently don't have a proper appeals process set up... so for now, you can just email maniacofhomebrew@nintendohomebrew.com with the following:\n* Why you think you should be unbanned\n* What rules you violated (if any)\nPlease do not spam, it may take a few days to respond.`);
                banEmbed.setColor("DarkRed");
                await user.send({embeds: [banEmbed]});
                await logChannel.send("DM succeeded!");
            } catch(err) {
                await logChannel.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
            }
            try {
                await user.ban({reason: args.slice(2).join(" ")});
            } catch(err) {
                await message.reply("Failed to ban member.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }
            var funnyOptions = [
                " has disintegrated.",
                "'s been gone.",
                " should've been more funky.",
                " forgot to pay their taxes.",
                " couldn't figure out 1 + 1 and left to search for the answer.",
                " fell into the ocean and drowned.",
                " walked the plank.",
                " hacked someone's Steam account and Valve handled them.",
                "'s been donated for nuclear research.",
                " was given the blue pill and can't continue going forward in this server.",
                "'s joined Team Rocket, and is now blasting off again.",
                " didn't stick the landing.",
                " felt the wrath of Darth Vader.",
                " was moved to a SanDian SD card.",
                " downloaded more RAM.",
                " was morphed into a New 2DS XL and was opened for repair.",
                " had their name written on the Death Note book."
            ];
            await message.reply(user.user.username + funnyOptions[~~(Math.random() * funnyOptions.length)] + "\n-# Ban successful.");
        }
    }
    return {
        onCommand
    };
}