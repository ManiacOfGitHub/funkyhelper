var {EmbedBuilder, Embed} = require("discord.js");
var util = require('../util');

var commandList = ["ban", "yeet", "scamkick", "kick", "takehelp", "nohelp", "givehelp", "yeshelp", "appealmute", "appealsmute", "appealsunmute", "appealunmute"];

module.exports = (client, logChannels, config, clientState) => {
    async function onCommand(command, args, message) {
        if(!commandList.includes(command)) return;
        if(!config.fullPermsMode) {
            await message.channel.send("You cannot use this command when `fullPermsMode` is disabled.");
            return;
        }
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
            if(!["ban","yeet"].includes(command) || !userId || userId.length > 19 || userId.length < 17) {
                await message.reply("Valid server member was not provided.");
                return;
            }
            if(!message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            try {
                await message.guild.bans.create(userId,{reason:args.slice(2).join(" ")});
            } catch(err) {
                await message.reply(`Server member was not found, unable to add user to ban list by ID.\nError info: ` + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }
            var funnyOptions = config.funnyOptions;
            await message.reply("User" + funnyOptions[~~(Math.random() * funnyOptions.length)] + "\n-# User was not found within the server, so they have been added to the ban list by ID. They have **not** been sent a DM.");
            let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${command} was used to ban a user`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Banned a user (user ID: ${userId}) from the server with the following reason:\n${args.length>2?("Reason: " + args.slice(2).join(" ")):"No reason was provided."}\nThis user was not found within the server, so they have been added to the ban list by ID. They have **not** been sent a DM.`);
			logEmbed.setFooter({text:"ID: " + userId});
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
            return;
        }
        if(util.hasRole(user, config.staffRoleList)) {
            await message.reply("FunkyHelper will not afflict any punishments upon staff, please do so manually.");
            return;
        }

        if(command=="ban" || command=="yeet") {
            if(!message.member.roles.cache.some(role=>role.id==config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            try {
                let banEmbed = new EmbedBuilder();
                banEmbed.setTitle("Moderation Action");
                banEmbed.setDescription(`**You have been banned from ${message.guild.name}.**\n**${args.length>2?("Reason: " + args.slice(2).join(" ")):"No reason was provided."}**\nWe currently don't have a proper appeals process set up... so for now, you can just email maniacofhomebrew@nintendohomebrew.com with the following:\n* Why you think you should be unbanned\n* What rules you violated (if any)\nPlease do not spam, it may take a few days to respond.`);
                banEmbed.setColor("DarkRed");
                await user.send({embeds: [banEmbed]});
                await logChannels.important.send("DM succeeded!");
            } catch(err) {
                await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
            }
            try {
                await user.ban({reason: args.slice(2).join(" ")});
            } catch(err) {
                await message.reply("Failed to ban member.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }
            var funnyOptions = config.funnyOptions;
            await message.reply(user.user.username + funnyOptions[~~(Math.random() * funnyOptions.length)] + "\n-# Ban successful.");
            let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${command} was used to ban a user`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Banned ${user.user.username} (user ID: ${userId}) from the server with the following reason:\n${args.length>2?("Reason: " + args.slice(2).join(" ")):"No reason was provided."}`);
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
            return;
        }
        if(command=="scamkick") {
            if(!util.hasRole(message.member, config.helperPlusRoleList) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            try {
                let scamKickedEmbed = new EmbedBuilder();
                scamKickedEmbed.setTitle("Suspicious Activity");
                scamKickedEmbed.setDescription("You have been kicked from " + message.guild.name + " due to messages that seem to be created by a bot that has hijacked your account. Once you have verified that your account is back under your control, you can rejoin [here](https://discord.gg/eVQkMaTQw2).");
                scamKickedEmbed.setColor("DarkRed");
                await user.send({embeds: [scamKickedEmbed]});
                await logChannels.important.send("DM succeeded!");
            } catch(err) {
                await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
            }

            try {
                await logChannels.important.send("Attempting to ban user (temporarily in order to remove messages)...");
                await user.ban({deleteMessageSeconds: 60 * 60 * 24, reason: ".scamkick run by "+message.member.user.username});
            } catch(err) {
                await logChannels.important.send(`<@&${config.activeModeratorsId}> Warning! ${user} was unable to be banned!\nReason: ` + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }

            await logChannels.important.send("Ban succeeded. Attempting to unban user...");
            try {
                await message.guild.bans.remove(userId);
                await logChannels.important.send("Unban succeeded.");
            } catch(err) {
                await logChannels.important.send(`<@&${config.activeModeratorsId}> Warning! ${user} was unable to be unbanned! Please ensure that user is able to rejoin server.\nReason: ` + (err?(err.message??"syke lmao"):"syke lmao"));
            }
            var funnyOptions = config.funnyOptions;
            await message.reply(user.user.username + funnyOptions[~~(Math.random() * funnyOptions.length)] + "\n-# Scammer Kicked.");
            let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${command} was used to scam kick a user`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Scam kicked ${user.user.username} (user ID: ${userId}) from the server.`);
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
            return;
        }
        if(command == "kick") {
            if(!util.hasRole(message.member, config.helperPlusRoleList) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            try {
                let kickedEmbed = new EmbedBuilder();
                kickedEmbed.setTitle("Moderation Action");
                kickedEmbed.setDescription(`**You have been kicked from ${message.guild.name}.**\n**${args.length>2?("Reason: " + args.slice(2).join(" ")):"No reason was provided."}**\nYou can rejoin the server.`);
                kickedEmbed.setColor("DarkRed");
                await user.send({embeds: [kickedEmbed]});
                await logChannels.important.send("DM succeeded!");
            } catch(err) {
                await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
            }

            try {
                await user.kick({reason: args.slice(2).join(" ")});
            } catch(err) {
                await message.reply("Failed to kick member.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }
            
            var funnyOptions = config.funnyOptions;
            await message.reply(user.user.username + funnyOptions[~~(Math.random() * funnyOptions.length)] + "\n-# Kick successful.");
            let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${command} was used to kick a user`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Kicked ${user.user.username} (user ID: ${userId}) from the server.`);
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
            return;
        }

        if(["takehelp", "nohelp"].includes(command)) {
            if(!util.hasRole(message.member, config.helperPlusRoleList) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            try {
                var appealsChannel = await message.guild.channels.fetch(config.appealsChannelId);
                let noHelpEmbed = new EmbedBuilder();
                noHelpEmbed.setTitle("Moderation Action");
                noHelpEmbed.setDescription(`**You have lost help channel privleges in ${message.guild.name}.**\n**${args.length>2?("Reason: " + args.slice(2).join(" ")):"No reason was provided."}**\nYou can appeal in the ${appealsChannel.url} channel.`);
                noHelpEmbed.setColor("DarkRed");
                await user.send({embeds: [noHelpEmbed]});
                await logChannels.important.send("DM succeeded!");
            } catch(err) {
                await logChannels.important.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
            }

            try {
                await user.roles.add(config.noHelpRoleId);
            } catch(err) {
                await message.reply("Failed to add restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }

            var funnyOptions = config.funnyOptions;
            await message.reply(user.user.username + funnyOptions[~~(Math.random() * funnyOptions.length)] + "\n-# User lost access to help channels.");
            let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${command} was used to remove help channel access from a user`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Gave nohelp role to ${user.user.username} (user ID: ${userId}).`);
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
            return;
        }

        if(["givehelp", "yeshelp"].includes(command)) {
            if(!util.hasRole(message.member, config.helperPlusRoleList) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }

            try {
                await user.roles.remove(config.noHelpRoleId);
            } catch(err) {
                await message.reply("Failed to remove restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }

            await message.reply("User is now free as a bird.");
            let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${command} was used to give help channel back to a user`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Removed nohelp role from ${user.user.username} (user ID: ${userId}).`);
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
            return;
        }

        if(["appealmute", "appealsmute"].includes(command)) {
            if(!util.hasRole(message.member, config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }

            try {
                await user.roles.add(config.appealMuteRoleId);
            } catch(err) {
                await message.reply("Failed to add restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }

            await message.reply(`${user.user.username} can no longer speak in <#${config.appealsChannelId}>.`);
            let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${command} was used to mute a user in <#${config.appealsChannelId}>`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Gave appealmute role to ${user.user.username} (user ID: ${userId}).`);
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
            return;
        }

        if(["appealunmute", "appealsunmute"].includes(command)) {
            if(!util.hasRole(message.member, config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }

            try {
                await user.roles.remove(config.appealMuteRoleId);
            } catch(err) {
                await message.reply("Failed to remove restriction.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
                return;
            }

            await message.reply(`${user.user.username} can now speak in <#${config.appealsChannelId}>.`);
            let logEmbed = new EmbedBuilder();
			logEmbed.setTitle(`.${command} was used to unmute a user in <#${config.appealsChannelId}>`);
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setDescription(`Removed appealmute role from ${user.user.username} (user ID: ${userId}).`);
			logEmbed.setTimestamp();
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
            return;
        }
    }
    return {
        onCommand,
        commandList
    };
}