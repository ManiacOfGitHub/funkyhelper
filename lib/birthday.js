var fs = require("fs");
var path = require('path');
var cron = require('node-cron');
var util = require('./util');
const { log } = require("console");
var birthdaysPath = path.resolve("./birthdays.json");
var birthdays;
var birthdayChannel;
var birthdayRole;

module.exports = (client, logChannel, config) => {
    async function onReady() {
        if(fs.existsSync(birthdaysPath)) {
            birthdays = require(birthdaysPath);
        } else {
            birthdays = {};
        }
        try {
            birthdayChannel = await client.channels.fetch(config.birthdayAnnouncementChannelId);
        } catch(err) {
            await logChannel.send("Failed to get birthday announcement channel.");
        }
        try {
            birthdayRole = await birthdayChannel.guild.roles.fetch(config.birthdayRoleId);
            if(!birthdayRole) throw new Error();
        } catch(err) {
            await logChannel.send("Failed to get the birthday role.");
            return;
        }
        cron.schedule('* * * * *', checkBirthday);
    }
    async function onCommand(commandName, args, message) {
        var isStaff = util.hasRole(message.member, config.staffRoleList);
        if(!["birthday","birth","cake"].includes(commandName)) return;
        if(args.length<2) {
            await message.reply("Argument not provided.");
            return;
        }
        if(["calendar","cal"].includes(args[1])) {
            return;
        }
        if(!isStaff) {
            await message.reply("Non-staff members can only use `.birthday calendar` (Alias: `.cake cal`).");
            return;
        }
        if(["add","set"].includes(args[1])) {
            if(args.length < 5) return;
            var birthdayUserId = args[2].match(/\d+/).join("");
            var birthdayUser;
            try {
                birthdayUser = await message.guild.members.fetch(birthdayUserId);
                if(!birthdayUser) throw Error();
            } catch(err) {
                await message.reply("Valid server member was not provided.");
                return;
            }
            try {
                var monthDay = args[3].match(/^(\d{1,2})[\/|-](\d{1,2})$/).slice(1).map(o=>o.padStart(2,"0")).join("-");
            } catch(err) {
                await message.reply("Invalid date specified.");
                return;
            }
            try {
                var timezoneOffset = args[4].match(/^([\+|-])(\d{1,2})(?::(\d{1,2}))?$/).slice(1);
                timezoneOffset[1] = timezoneOffset[1].padStart(2,"0");
                if(!timezoneOffset[2]) timezoneOffset[2]="00";
                timezoneOffset[2] = timezoneOffset[2].padStart(2,"0");
                timezoneOffset = `${timezoneOffset.slice(0,2).join("")}:${timezoneOffset[2]}`;
            } catch(err) {
                await message.reply("Invalid UTC offset provided.\nExamples of acceptable formats:\nEDT: -4, -04, -04:00\nCWT: +08:45, +8:45\nCDT: -5, -05, -05:00");
                return;
            }
            var currentTime = new Date();
            var currentYear = currentTime.getUTCFullYear();
            var nextBirthday = new Date(`${currentYear}-${monthDay}T00:00:00${timezoneOffset}`);
            if(nextBirthday.getTime()<=currentTime.getTime()) {
                nextBirthday = new Date(`${currentYear+1}-${monthDay}T00:00:00${timezoneOffset}`);
                if(nextBirthday.getTime()<=currentTime.getTime()) {
                    await message.reply("Wow, maniac cannot code worth a dang apparently. Let him know that and tell him that the birthday never exceeded the current time.");
                    return;
                }
            }
            birthdays[birthdayUserId] = {
                monthDay,
                timezoneOffset,
                nextBirthday: nextBirthday.getTime(),
                birthdayActive: false
            };
            nextBirthday.setDate(nextBirthday.getDate()+1);
            birthdays[birthdayUserId].endBirthday = nextBirthday.getTime();
            updateBirthdaysFile();
            await message.reply("User's birthday set!");
            return;
        }
        if(["delete","del","remove"].includes(args[1])) {
            var birthdayUserId = args[2].match(/\d+/).join("");
            if(!birthdays.hasOwnProperty(birthdayUserId)) {
                await message.reply("User does not have a birthday set.");
                return;
            }
            delete birthdays[birthdayUserId];
            updateBirthdaysFile();
            await message.reply("User's birthday deleted!");
            return;
        }
        await message.reply("Invalid argument. Valid arguments: set (add), delete (del, remove), calendar (cal)");
        return;
    }
    async function checkBirthday() {
        var currentTime = new Date();
        for(var userId in birthdays) {
            if((currentTime.getTime() >= birthdays[userId].nextBirthday) && !birthdays[userId].birthdayActive) {
                
                try {
                    var member = await birthdayChannel.guild.members.fetch(userId);
                    if(!member) throw new Error();
                } catch(err) {
                    await logChannel.send("User <@" + userId + "> (" + userId + ") has their birthday today, but they seem to no longer be in the server... Deleting them from the birthday list.");
                    delete birthdays[userId];
                    updateBirthdaysFile();
                    return;
                }
                await member.roles.add(birthdayRole, "FunkyHelper remembers birthdays unlike Maniac...");
                await birthdayChannel.send(":cake: __**<@"+ userId + ">'s birthday is today!**__ :cake:\nHave the most funky of days!");
                birthdays[userId].birthdayActive = true;
                updateBirthdaysFile();
                return;
            }
            if((currentTime.getTime() >= birthdays[userId].endBirthday) && birthdays[userId].birthdayActive) {
                var member = await birthdayChannel.guild.members.fetch(userId);
                await member.roles.remove(birthdayRole, "FunkyHelper hopes you had a good birthday.");
                birthdays[userId].birthdayActive = false;
                var currentYear = currentTime.getUTCFullYear();
                var nextBirthday = new Date(`${currentYear+1}-${birthdays[userId].monthDay}T00:00:00${birthdays[userId].timezoneOffset}`);
                if(nextBirthday.getTime()<=currentTime.getTime()) {
                    await logChannel.send("Wow, maniac cannot code worth a dang apparently. Let him know that and tell him that the birthday never exceeded the current time.");
                    return;
                }
                birthdays[userId].nextBirthday = nextBirthday.getTime();
                nextBirthday.setDate(nextBirthday.getDate()+1)
                birthdays[userId].endBirthday = nextBirthday.getTime();
                updateBirthdaysFile();
            }
        }
    }
    function updateBirthdaysFile() {
        fs.writeFileSync(birthdaysPath, JSON.stringify(birthdays, null, 2));
    }
    return {
        onReady,
        onCommand
    }
}