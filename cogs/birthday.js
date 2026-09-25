var fs = require("fs");
var path = require('path');
var cron = require('node-cron');
var util = require('../util');
const { log } = require("console");
const { SlashCommandBuilder, InteractionContextType } = require("discord.js");
var birthdaysPath = path.resolve("./birthdays.json");
var birthdays;
var birthdayChannel;
var birthdayRole;

module.exports = (client, logChannels, config, botContext) => {
    async function onReady() {
        if(fs.existsSync(birthdaysPath)) {
            birthdays = require(birthdaysPath);
        } else {
            birthdays = {};
        }
        try {
            birthdayChannel = await client.channels.fetch(config.birthdayAnnouncementChannelId);
        } catch(err) {
            await logChannels.important.send("Failed to get birthday announcement channel.");
        }
        try {
            birthdayRole = await birthdayChannel.guild.roles.fetch(config.birthdayRoleId);
            if(!birthdayRole) throw new Error();
        } catch(err) {
            await logChannels.important.send("Failed to get the birthday role.");
            return;
        }
        cron.schedule('* * * * *', checkBirthday);
    }
    async function checkBirthday() {
        var currentTime = new Date();
        for(var userId in birthdays) {
            if((currentTime.getTime() >= birthdays[userId].nextBirthday) && !birthdays[userId].birthdayActive) {
                
                try {
                    var member = await birthdayChannel.guild.members.fetch(userId);
                    if(!member) throw new Error();
                } catch(err) {
                    await logChannels.important.send("User <@" + userId + "> (" + userId + ") has their birthday today, but they seem to no longer be in the server... Deleting them from the birthday list.");
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
                    await logChannels.important.send("Wow, maniac cannot code worth a dang apparently. Let him know that and tell him that the birthday never exceeded the current time.");
                    return;
                }
                birthdays[userId].nextBirthday = nextBirthday.getTime();
                nextBirthday.setDate(nextBirthday.getDate()+1)
                birthdays[userId].endBirthday = nextBirthday.getTime();
                updateBirthdaysFile();
            }
        }
    }
    async function birthdayCmdHandler(isSlash, params, ctx) {
        if(isSlash) await ctx.deferReply();
        var reply = util.ctxReplier(ctx, isSlash);
        var isStaff = util.hasRole(ctx.member, config.staffRoleList);
        var subcmd = params.subcmd || (isSlash ? ctx.options.getSubcommand() : false);
        if(!subcmd) {
            await reply("No subcommand provided.");
            return;
        }
        if(["calendar","cal"].includes(subcmd)) {
            var currentMonth = (new Date().getUTCMonth()+1).toString().padStart(2,"0");
            var birthdaysThisMonth = Object.fromEntries(Object.entries(birthdays).filter(([id, data])=>data.monthDay.startsWith(currentMonth)).sort(([id1, data1],[id2,data2])=>{
                var date1 = parseInt(data1.monthDay.split("-")[1]);
                var date2 = parseInt(data2.monthDay.split("-")[1]);
                return date1 - date2;
            }));

            var birthdaysFormatted = [];
            var currentTime = new Date();
            var currentYear = currentTime.getUTCFullYear();
            for(var id in birthdaysThisMonth) {                
                let dateThisYear = new Date(`${currentYear}-${birthdaysThisMonth[id].monthDay}T00:00:00${birthdaysThisMonth[id].timezoneOffset}`);
                let dateStr = dateThisYear.toLocaleString('default', { month: 'long', day: 'numeric' });
                let timestampStr = Math.floor(dateThisYear.getTime()/1000).toString();
                
                birthdaysFormatted.push(`**<@${id}> - ${dateStr}**\n-# Start: <t:${timestampStr}:R> at <t:${timestampStr}:t> in your timezone (UTC offset ${birthdaysThisMonth[id].timezoneOffset})`);
            }
            var monthStr = currentTime.toLocaleString('default', {month: 'long'});
            if(!birthdaysFormatted.length) {
                return await reply("There are no birthdays set for any users in "+monthStr+".");
            }
            await reply({content:`# __Birthdays in ${monthStr}__\n${birthdaysFormatted.join("\n\n")}`,allowedMentions:{parse:[]}});
            return;
        }
        if(!isStaff) {
            await reply(`Non-staff members can only use \`${isSlash?"/":"."}birthday calendar\`${!isSlash ? " (Alias: `.cake cal`)" : ""}.`);
            return;
        }
        if(["add","set"].includes(subcmd)) {
            if(!params.member || !params.date || !params.offset) {
                await reply("Not enough arguments.");
                return;
            }
            var birthdayUser = params.member;
            if(!birthdayUser.id) {
                try {
                    birthdayUser = await botContext.guild.members.fetch(birthdayUser);
                    if(!birthdayUser) throw Error();
                } catch(err) {
                    await reply("Valid server member was not provided.");
                    return;
                }
            }
            try {
                var monthDay = params.date.match(/^(\d{1,2})[\/|-](\d{1,2})$/).slice(1).map(o=>o.padStart(2,"0")).join("-");
            } catch(err) {
                await reply("Invalid date specified.");
                return;
            }
            try {
                var timezoneOffset = params.offset.match(/^([\+|-])(\d{1,2})(?::(\d{1,2}))?$/).slice(1);
                timezoneOffset[1] = timezoneOffset[1].padStart(2,"0");
                if(!timezoneOffset[2]) timezoneOffset[2]="00";
                timezoneOffset[2] = timezoneOffset[2].padStart(2,"0");
                timezoneOffset = `${timezoneOffset.slice(0,2).join("")}:${timezoneOffset[2]}`;
            } catch(err) {
                await reply("Invalid UTC offset provided.\nExamples of acceptable formats:\nEDT: -4, -04, -04:00\nCWT: +08:45, +8:45\nCDT: -5, -05, -05:00");
                return;
            }
            var currentTime = new Date();
            var currentYear = currentTime.getUTCFullYear();
            var nextBirthday = new Date(`${currentYear}-${monthDay}T00:00:00${timezoneOffset}`);
            if(nextBirthday.getTime()<=currentTime.getTime()) {
                nextBirthday = new Date(`${currentYear+1}-${monthDay}T00:00:00${timezoneOffset}`);
                if(nextBirthday.getTime()<=currentTime.getTime()) {
                    await reply("Wow, maniac cannot code worth a dang apparently. Let him know that and tell him that the birthday never exceeded the current time.");
                    return;
                }
            }
            birthdays[birthdayUser.id] = {
                monthDay,
                timezoneOffset,
                nextBirthday: nextBirthday.getTime(),
                birthdayActive: false
            };
            nextBirthday.setDate(nextBirthday.getDate()+1);
            birthdays[birthdayUser.id].endBirthday = nextBirthday.getTime();
            updateBirthdaysFile();
            await reply("User's birthday set!");
            return;
        }
        if(["delete","del","remove"].includes(subcmd)) {
            var birthdayUser = params.member;
            if(!birthdayUser.id) {
                var birthdayUserId = birthdayUser;
            } else {
                var birthdayUserId = birthdayUser.id;
            }
            if(!birthdays.hasOwnProperty(birthdayUserId)) {
                await reply("User does not have a birthday set.");
                return;
            }
            delete birthdays[birthdayUserId];
            updateBirthdaysFile();
            await reply("User's birthday deleted!");
            return;
        }
        await reply("Invalid subcommand. Valid subcommands: set (add), delete (del, remove), calendar (cal)");
        return;
    }
    function updateBirthdaysFile() {
        fs.writeFileSync(birthdaysPath, JSON.stringify(birthdays, null, 2));
    }
    return {
        onReady,
        commands: {
            birthday: {
                prefix: {
                    name: "birthday",
                    aliases: ["birth", "cake"],
                    params: [
                        {
                            name: "subcmd",
                            type: "text"
                        },
                        {
                            name: "member",
                            type: "member",
                            optional: true
                        },
                        {
                            name: "date",
                            type: "text",
                            optional: true
                        },
                        {
                            name: "offset",
                            type: "text",
                            optional: true
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("birthday")
                    .setDescription("Cake day stuff")
                    .addSubcommand((subcommand)=>
                        subcommand
                        .setName("calendar")
                        .setDescription("Shows all birthdays that are happening in the current month, usable by anyone")
                    )
                    .addSubcommand((subcommand)=>
                        subcommand
                        .setName("set")
                        .setDescription("Adds the birthday of a user to the calendar, Helper+ only")
                        .addUserOption(option=>option.setName("member").setDescription("User").setRequired(true))
                        .addStringOption(option=>option.setName("date").setDescription("mm/dd").setRequired(true))
                        .addStringOption(option=>option.setName("offset").setDescription("UTC offset at time of birthday, remember DST! (e.g. -4:30)").setRequired(true))
                    )
                    .addSubcommand((subcommand)=>
                        subcommand
                        .setName("delete")
                        .setDescription("Deletes the birthday of a user from the calendar, Helper+ only")
                        .addUserOption(option=>option.setName("member").setDescription("User").setRequired(true))
                    )
                    .setContexts(InteractionContextType.Guild)
                },
                handler: birthdayCmdHandler
            }
        }
    }
}