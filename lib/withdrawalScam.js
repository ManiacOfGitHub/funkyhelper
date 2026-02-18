/*
This library detects a common scam posted by bots on hijacked Discord accounts with 4 images and the "Withdrawal Success!" message on the last 2 images.
*/

var {EmbedBuilder, AttachmentBuilder} = require("discord.js");
var util = require('./util');
var fs = require('fs');
var scribe;
var lock = false;

module.exports = (client, logChannel, config) => {
    async function onReady() {
        scribe = (await import('scribe.js-ocr')).default;
    }

    async function onMessage(message) {
        if(lock) return;
        if(!config.fullPermsMode || !config.withdrawalScamCheckEnabled) return;
        if(message.attachments.size != 4) return;
        if(message.content != "") return;

        var scamCount = 0;
        var attachments = [...message.attachments.values()];
        for(var i in attachments) {
            if(!attachments[i].contentType.startsWith("image")) return;
        }
        lock = true;

        let terms = ["withdraw", "promo code", "promocode", "was successfull", ...config.extraWithdrawalScamTerms];

        let suspiciousMsgEmbed = new EmbedBuilder();
        suspiciousMsgEmbed.setTitle("Potential Withdrawal Scam Message Detected!");
        suspiciousMsgEmbed.setDescription("The bot has detected a suspicious message (4 images, no message content).\nThis message will now be processed with OCR to see if it's the withdrawal scam.\n"+message.url+"\nThe following terms will be used: " + terms.join(", ")+"\nDuring this testing, no other messages will be observed for the withdrawal scam.");
        suspiciousMsgEmbed.setColor("Gold");
        await logChannel.send({embeds:[suspiciousMsgEmbed]});

        for(var i in attachments) {
            await logChannel.send("Downloading attachment " + (parseInt(i) + 1) + " of 4");
            let file = await fetch(attachments[i].url);
			let fileData = Buffer.from(await file.arrayBuffer());
            fs.writeFileSync(attachments[i].name, fileData);
            await logChannel.send({files: [attachments[i].name]});

            await logChannel.send("Testing attachment " + (parseInt(i) + 1) + " of 4");
            var text = await scribe.extractText([attachments[i].name]);
            var textFile = new AttachmentBuilder().setName(attachments[i].name.split(".").slice(0,-1).join(".") + ".txt").setFile(Buffer.from(text));
            await logChannel.send({content: "Attachment " + (parseInt(i) + 1) + " contains the following text:", files: [textFile]});
            fs.unlinkSync(attachments[i].name);
            terms.forEach(a=>{
                if(text.toLowerCase().includes(a)) {
                    scamCount++;
                }
            })
            await logChannel.send("Attachment " + (parseInt(i) + 1) + " has been processed. The scamCount is now " + scamCount.toString() + ".");
            if(scamCount >= 2) break;
        }

        if(scamCount < 2) {
            let scamNotDetectedEmbed = new EmbedBuilder();
            scamNotDetectedEmbed.setTitle("Withdrawal Scam Not Detected");
            scamNotDetectedEmbed.setDescription("This message seems to be legit. Let a Bot Owner know if this is incorrect.");
            scamNotDetectedEmbed.setColor("Green");
            await logChannel.send({embeds: [scamNotDetectedEmbed]});
            await liftLock();
            return;
        }

        let scamDetectedEmbed = new EmbedBuilder();
        scamDetectedEmbed.setTitle("Withdrawal Scam Detected!");
        scamDetectedEmbed.setDescription("The message has been detected to be a withdrawal scam.\nThe user will now be kicked and all messages in the last 24 hours will be removed.\nAttempting to DM the user...");
        scamDetectedEmbed.setColor("Red");
        await logChannel.send({embeds: [scamDetectedEmbed]});

        try {
            let scamKickedEmbed = new EmbedBuilder();
            scamKickedEmbed.setTitle("Suspicious Activity");
            scamKickedEmbed.setDescription("You have been kicked from " + message.guild.name + " due to messages that seem to be created by a bot that has hijacked your account. Once you have verified that your account is back under your control, you can rejoin [here](https://discord.gg/eVQkMaTQw2).");
            scamKickedEmbed.setColor("DarkRed");
            await message.member.send({embeds: [scamKickedEmbed]});
            await logChannel.send("DM succeeded!");
        } catch(err) {
            await logChannel.send("DM failed. (DMs are likely disabled by the user.) Continuing regardless...");
        }


        var messageText = `Here are all the original attachments for review.`;
		let files = [];
        for (var attachment of attachments) {
            if (!attachment.url) continue;
            if (attachment.size <= 10 * (10 ** 6)) {
                try {
                    let file = await fetch(attachment.url);
                    let fileData = Buffer.from(await file.arrayBuffer());
                    files.push(new AttachmentBuilder(fileData, { name: attachment.name }));
                    continue;
                } catch (err) { }
            }
            messageText += `\n<@&${config.activeModeratorsId}> ` + attachment.url + " (This file could not be permanently downloaded. This link may stop functioning at some point.)";
        }
        await logChannel.send({ content: messageText, flags: [4096], files });

        let id = message.member.id;

        try {
            await logChannel.send("Attempting to ban user (temporarily in order to remove messages)...");
            if(util.hasRole(message.member, config.staffRoleList)) throw Error("Member is staff, ban protection activated");
            await message.member.ban({deleteMessageSeconds: 60 * 60 * 24, reason: "Withdrawal Scam Detected by FunkyHelper"});
        } catch(err) {
            await logChannel.send(`<@&${config.activeModeratorsId}> Warning! ${message.member} was unable to be banned!\nReason: ` + (err?(err.message??"syke lmao"):"syke lmao"));
            await liftLock();
            return;
        }

        try {
            await logChannel.send("Ban succeeeded. Attempting to unban user...");
            await message.guild.bans.remove(id);
            await logChannel.send("Unban succeeded.");
        } catch(err) {
            await logChannel.send(`<@&${config.activeModeratorsId}> Warning! ${message.member} was unable to be unbanned! Please ensure that user is able to rejoin server.\nReason: ` + (err?(err.message??"syke lmao"):"syke lmao"));
        }


        await liftLock();
    }

    async function liftLock() {
        let lockLiftedEmbed = new EmbedBuilder();
        lockLiftedEmbed.setTitle("Withdrawal Scam Lock Lifted");
        lockLiftedEmbed.setDescription("The suspicious message has now been processed, so the bot will now listen for more suspicious messages.");
        lockLiftedEmbed.setColor("Blue");
        await logChannel.send({embeds: [lockLiftedEmbed]});
        lock = false;
    }

    return {
        onReady,
        onMessage,
        liftLock
    }
}