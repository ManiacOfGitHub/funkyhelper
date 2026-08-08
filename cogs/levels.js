var commandList = ["setxp", "setexp", "addxp", "addexp", "deluserlvls", "rank"];
var db, expFetcher, userUpdateFunction, levelUpChannel;
var calculateLevel = exp=>exp?~~(exp/100)+1:0;
var {EmbedBuilder} = require('discord.js');
var util = require('../util');
var canvas = require('canvas');
var fs = require('fs');

module.exports = (client, logChannels, config, botContext)=>{
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

            ctx.font = 'normal 55px "Roboto Bold"';
            ctx.fillStyle = "white";
            ctx.fillText(member.displayName, 280, 164);

            var out = fs.createWriteStream(__dirname + '/test.png');
            rankCanvas.createPNGStream().pipe(out);

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
                description += `\nThey have now also earned <@&${roleAddedId}> (and any roles beneath it)! Yippee!`;
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

    return {
        commandList,
        onReady,
        onMessage,
        onCommand
    }
};