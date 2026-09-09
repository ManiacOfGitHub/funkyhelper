var commandList = ["setxp", "setexp", "addxp", "addexp", "deluserlvls", "rank", "fixroles", "setlevel"];
var db, expFetcher, userUpdateFunction, levelUpChannel;
var {EmbedBuilder, AttachmentBuilder} = require('discord.js');
var util = require('../util');
var canvas = require('canvas');
var fs = require('fs');

module.exports = (client, logChannels, config, botContext)=>{
    var calculateLevel = exp=>exp>=config.firstRankExpLength?~~(exp/config.rankExpLength)+1:0;
    async function onReady() {
        db = botContext.db;
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_exp (
                user_id INTEGER PRIMARY KEY,
                exp INTEGER DEFAULT 0
            )
        `).run();
        expFetcher = db.prepare("SELECT exp FROM user_exp WHERE user_id = ?");
        userUpdateFunction = db.prepare(`
            INSERT INTO user_exp (user_id, exp)
            VALUES (:user_id, :exp)
            ON CONFLICT(user_id) DO UPDATE SET
                exp = excluded.exp
        `);
        levelUpChannel = await client.channels.fetch(config.levelUpChannelId);
        canvas.registerFont('public/Roboto.ttf', {family: 'Roboto'});
    }

    async function onMessage(message) {
        var id = message.author.id;
        var fetchedData = expFetcher.get(id);
        var userExp = fetchedData?.exp || 0;
        if(isNaN(userExp)) userExp = 0;
        var currentLevel = calculateLevel(userExp);
        userExp++;
        await setExp(message.member, userExp);
    }

    async function onCommand(command, args, message) {
        if(!commandList.includes(command)) return;
        if(["setxp","setexp","addxp","addexp"].includes(command)) {
            if(!util.hasRole(message.member, config.helperPlusRoleList) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            if(args.length < 3) {
                await message.reply(`Not enough arguments.\nUsage: .${command} (user) (exp)`);
                return;
            }
            var user, userId;
            try {
                userId = args[1].match(/\d+/).join("");
                user = await message.guild.members.fetch(userId);
                if(!user) throw Error();
            } catch(err) {
                await message.reply("Valid server member was not provided.");
                return;
            }
            var exp = parseInt(args[2]);
            if(!Number.isInteger(exp)) {
                await message.reply("Invalid exp value provided.");
                return;
            }
            if(["addxp","addexp"].includes(command)) {
                var fetchedData = expFetcher.get(userId);
                var userExp = fetchedData?.exp || 0;
                exp+=userExp;
            }
            await setExp(user, exp);
            await message.reply({content:`${user}'s experience was set to ${exp}! Their level is now ${calculateLevel(exp)}.`});
            return;
        }
        if(command=="setlevel") {
            if(!util.hasRole(message.member, config.helperPlusRoleList) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            if(args.length < 3) {
                await message.reply(`Not enough arguments.\nUsage: .${command} (user) (exp)`);
                return;
            }
            var user, userId;
            try {
                userId = args[1].match(/\d+/).join("");
                user = await message.guild.members.fetch(userId);
                if(!user) throw Error();
            } catch(err) {
                await message.reply("Valid server member was not provided.");
                return;
            }
            var level = parseInt(args[2]);
            if(!Number.isInteger(level)) {
                await message.reply("Invalid level value provided.");
                return;
            }
            var exp = (level > 1 ? ((level - 1) * config.rankExpLength) : config.firstRankExpLength * level);
            await setExp(user, exp);
            await message.reply({content:`${user}'s level was set to ${level}! Their experience is now ${exp}.`});
            return;
        }
        if(command=="deluserlvls") {
            if(!util.hasRole(message.member, config.helperPlusRoleList) && !config.botOwners.includes(message.member.id)) {
                await message.channel.send("no");
                return;
            }
            if(args.length < 2) {
                await message.reply(`Not enough arguments.\nUsage: .${command} (user) (exp)`);
                return;
            }
            if(!expFetcher.get(args[1])) {
                await message.reply("User ID is not in level database.");
                return;
            }
            db.prepare(`DELETE FROM user_exp WHERE user_id = ?`).run(args[1]);
            await message.reply(`Deleted user \`${args[1]}\` from level database.`);
            return;
        }
        if(command=="rank") {
            var member, userId;
            try {
                userId = args[1].match(/\d+/).join("");
                member = await message.guild.members.fetch(userId);
                if(!member) throw Error();
            } catch(err) {
                member = message.member;
            }
            var fetchedData = expFetcher.get(member.id);
            var userExp = fetchedData?.exp || 0;
            if(isNaN(userExp)) userExp = 0;
            var userProgress = calculateProgress(userExp);

            var rankCanvas = canvas.createCanvas(1094, 272);
            var ctx = rankCanvas.getContext('2d');
            ctx.save();

            ctx.fillStyle = "rgb(33,39,51)";
            ctx.fillRect(0, 0, rankCanvas.width, rankCanvas.height);

            ctx.beginPath();

            ctx.arc(136, 136, 128, 0, Math.PI * 2);
            ctx.clip();
            var avatar = await canvas.loadImage(member.user.displayAvatarURL({extension:"png",size:256}));
            ctx.drawImage(avatar, 8, 8);

            ctx.closePath();
            ctx.restore();

            ctx.strokeStyle = "2px black";
            ctx.arc(136, 136, 128, 0, Math.PI * 2);
            ctx.stroke();

            var fontSize = 70;
            ctx.font = `normal ${fontSize}px "Roboto Bold"`;
            while(ctx.measureText(member.displayName).width > 500) {
                fontSize--;
                ctx.font = `normal ${fontSize}px "Roboto Bold"`;
            }
            ctx.fillStyle = "white";
            ctx.fillText(member.displayName, 280, 153, 500);
            
            var percentage = userProgress.xpIntoLevel / (userProgress.level?config.rankExpLength:config.firstRankExpLength);
            drawLevelBar(ctx, percentage);

            ctx.save();
            ctx.font = 'normal 20px "Roboto Bold"';
            ctx.textAlign = 'right';
            ctx.fillStyle = "rgb(93,99,111)";
            ctx.fillText(`EXP: ${userExp}/${userProgress.xpForNextLevel}`, 970, 164);
            ctx.font = 'normal 30px "Roboto Bold"';
            ctx.fillStyle = "rgb(193,199,211)";
            ctx.fillText(`LEVEL ${userProgress.level}`, 970, 140);
            ctx.restore();

            var stream = rankCanvas.createPNGStream();
            var attachment = new AttachmentBuilder(stream,{name: member.user.id+"_rank.png"});
            message.reply({files:[attachment]});
        }
        if(command=="fixroles") {
            var member, userId;
            try {
                userId = args[1].match(/\d+/).join("");
                member = await message.guild.members.fetch(userId);
                if(!member) throw Error();
            } catch(err) {
                member = message.member;
            }
            await updateRoles(member);
            await message.reply("Attempted to add roles based on current XP!");
        }
    }

    async function setExp(member, exp) {
        var fetchedData = expFetcher.get(member.id);
        var userExp = fetchedData?.exp || 0;
        if(isNaN(userExp)) userExp = 0;
        var currentLevel = calculateLevel(userExp);
        userUpdateFunction.run({user_id:member.id,exp:exp});
        var newLevel = calculateLevel(exp);
        if(newLevel > currentLevel) {
            var roleAddedId = await updateRoles(member);
            var description = `**Congratulations!**\n${member} is now level ${newLevel}!!!`;
            if(roleAddedId) {
                description += `\nThey have now also earned <@&${roleAddedId}>! Yippee!`;
            }
            let levelUpEmbed = new EmbedBuilder()
            .setAuthor({name: member.displayName, iconURL: member.user.displayAvatarURL({extension:"png",size:2048})})
            .setTitle(`LEVEL UP!`)
            .setDescription(description)
            .setTimestamp()
            .setColor(roleAddedId?"Gold":"Green");
            if(roleAddedId) {
                await levelUpChannel.send({content:member.toString(),embeds:[levelUpEmbed]});
            } else {
                await levelUpChannel.send({embeds: [levelUpEmbed]});
            }
        }
    }

    async function updateRoles(member) {
        var fetchedData = expFetcher.get(member.id);
        var userExp = fetchedData?.exp || 0;
        if(isNaN(userExp)) userExp = 0;
        var level = calculateLevel(userExp);
        var addedARole = false;
        var topRoleId = null;
        for(var i in config.levelUpRoles) {
            if(level>=config.levelUpRoles[i][0]) {
                if(util.hasRole(member, config.levelUpRoles[i][1])) {
                    continue;
                }
                addedARole = true;
                topRoleId = config.levelUpRoles[i][1];
                member.roles.add(topRoleId);
                continue;
            }
            break;
        }
        if(!addedARole) return false;
        return topRoleId;
    }

    function drawLevelBar(ctx, percent) {
        drawCylinder(ctx, "rgb(93,99,111)", 650);
        drawCylinder(ctx, "lightgreen", ~~(percent*650));
    }

    function drawCylinder(ctx, color, lengthOfGap) {
        ctx.beginPath();
        ctx.fillStyle = color; 
        ctx.arc(300, 194, 20, Math.PI/2, -Math.PI/2, false);
        ctx.fill();

        ctx.fillRect(300, 174, lengthOfGap, 40);

        ctx.arc(300+lengthOfGap, 194, 20, Math.PI/2, -Math.PI/2, true);
        ctx.fill();

        ctx.closePath();
    }

    function calculateProgress(exp) {
        var level = calculateLevel(exp);
        var xpIntoLevel = level > 0 ? (exp % config.rankExpLength) : (exp % config.firstRankExpLength);
        var xpForNextLevel = level > 0 ? (level * config.rankExpLength) : config.firstRankExpLength;
        return {
            level,
            xpIntoLevel,
            xpForNextLevel
        };
    }

    return {
        commandList,
        onReady,
        onMessage,
        onCommand
    }
};