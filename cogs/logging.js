var {AuditLogEvent, EmbedBuilder, Events} = require("discord.js");
var ms = require("ms");

module.exports = (client, logChannels, config, clientState) => {
    async function onReady() {
        client.on(Events.GuildAuditLogEntryCreate, auditLogEvent);
        client.on(Events.MessageDelete, messageDeleteHandler);
        client.on(Events.MessageBulkDelete, messageBulkDeleteHandler);
        client.on(Events.MessageUpdate, messageEditHandler);
    }
    async function auditLogEvent(auditEntry, guild) {
        try {
            switch(auditEntry.action) {
                case AuditLogEvent.MemberRoleUpdate:
                    await memberRoleUpdateHandler(auditEntry, guild);
                    break;
                case AuditLogEvent.MemberBanAdd:
                    await memberBanHandler(auditEntry);
                    break;
                case AuditLogEvent.MemberBanRemove:
                    await memberUnbanHandler(auditEntry);
                    break;
                case AuditLogEvent.MemberUpdate: // Timeouts
                    await memberTimeoutHandler(auditEntry);
                    break;
                case AuditLogEvent.MemberKick:
                    await memberKickHandler(auditEntry);
                    break;
            }
        } catch(err) {
            console.error(err);
            try {
                await logChannels.important.send("Failed to process audit log entry creation\nError info: " + (err?(err.message??"syke lmao"):"syke lmao")) 
            } catch(err) {}
        }
    }

    async function memberRoleUpdateHandler(auditEntry, guild) {
        let minRolePosition = (await guild.roles.fetch(config.logMinRole)).position;
		for(var change of auditEntry.changes) {
			let roleIds = [];
			for(var role of change.new) {
				var role = await guild.roles.fetch(role.id);
				if(role.position>=minRolePosition) {
					roleIds.push(role.id);
				}
			}
			if(roleIds.length < 1) return;
			if(change.key=="$add") {
				let addRoleEmbed = new EmbedBuilder();
				addRoleEmbed.setAuthor({name:auditEntry.target.username,iconURL:auditEntry.target.displayAvatarURL({extension:"png",size:2048})});
				addRoleEmbed.setTitle(`Role${(roleIds.length > 1) ? "s" : ""} added`);
				addRoleEmbed.setDescription(`${roleIds.map(o=>`<@&${o}>`).join(", ")}`);
				addRoleEmbed.setFooter({text:"ID: " + auditEntry.target.id});
				addRoleEmbed.setTimestamp();
                addRoleEmbed.setColor("Blue");
				await logChannels.normal.send({embeds: [addRoleEmbed], allowedMentions: {roles: []}});
			}
			if(change.key=="$remove") {
				let removeRoleEmbed = new EmbedBuilder();
				removeRoleEmbed.setAuthor({name:auditEntry.target.username,iconURL:auditEntry.target.displayAvatarURL({extension:"png",size:2048})});
				removeRoleEmbed.setTitle(`Role${(roleIds.length > 1) ? "s" : ""} removed`);
				removeRoleEmbed.setDescription(`${roleIds.map(o=>`<@&${o}>`).join(", ")}`);
				removeRoleEmbed.setFooter({text:"ID: " + auditEntry.target.id});
				removeRoleEmbed.setTimestamp();
                removeRoleEmbed.setColor("Blue");
				await logChannels.normal.send({embeds: [removeRoleEmbed], allowedMentions: {roles: []}});
			}
		}
    }

    async function memberKickHandler(auditEntry) {
        try {
            var targetUser = await client.users.fetch(auditEntry.targetId);
            let logEmbed = new EmbedBuilder()
            .setAuthor({name: targetUser.username, iconURL: targetUser.displayAvatarURL({extension:"png",size:2048})})
            .setTitle(`Member kicked`)
            .setDescription(`**User:** ${targetUser.toString()}\n**Reason:** ${auditEntry.reason || "No reason provided."}\n**Responsible moderator:** ${await client.users.fetch(auditEntry.executorId)}`)
            .setFooter({text:"ID: " + targetUser.id})
            .setTimestamp()
            .setColor("Red");
            await logChannels.normal.send({embeds: [logEmbed], allowedMentions: {roles: [], parse: []}});
        } catch(err) {
            console.error(err);
            try {
                await logChannels.important.send("Failed to process member kick event.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            } catch(err) {};
        }
    }

    async function memberBanHandler(auditEntry) {
        try {
            var bannedUser = await client.users.fetch(auditEntry.targetId);
            let logEmbed = new EmbedBuilder()
            .setAuthor({name: bannedUser.username, iconURL: bannedUser.displayAvatarURL({extension:"png",size:2048})})
            .setTitle(`Member banned`)
            .setDescription(`**User:** ${bannedUser.toString()}\n**Reason:** ${auditEntry.reason || "No reason provided."}\n**Responsible moderator:** ${await client.users.fetch(auditEntry.executorId)}`)
            .setFooter({text:"ID: " + bannedUser.id})
            .setTimestamp()
            .setColor("Red");
            await logChannels.normal.send({embeds: [logEmbed], allowedMentions: {roles: [], parse: []}});
        } catch(err) {
            console.error(err);
            try {
                await logChannels.important.send("Failed to process member ban event.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            } catch(err) {};
        }
    }

    async function memberUnbanHandler(auditEntry) {
        try {
            var unbannedUser = await client.users.fetch(auditEntry.targetId);
            let logEmbed = new EmbedBuilder()
            .setAuthor({name: unbannedUser.username, iconURL: unbannedUser.displayAvatarURL({extension:"png",size:2048})})
            .setTitle(`Member unbanned`)
            .setDescription(`**User:** ${unbannedUser.toString()}\n**Reason:** ${auditEntry.reason || "No reason provided."}\n**Responsible moderator:** ${await client.users.fetch(auditEntry.executorId)}`)
            .setFooter({text:"ID: " + unbannedUser.id})
            .setTimestamp()
            .setColor("Aqua");
            await logChannels.normal.send({embeds: [logEmbed], allowedMentions: {roles: [], parse: []}});
        } catch(err) {
            console.error(err);
            try {
                await logChannels.important.send("Failed to process member unban event.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            } catch(err) {};
        }
    }

    async function memberTimeoutHandler(auditEntry) {
        var timeoutChange = auditEntry.changes.find(change=>change.key == "communication_disabled_until");
        if(!timeoutChange) return;
        var targetUser = await client.users.fetch(auditEntry.targetId);
        if(timeoutChange.new) {
            let endDate = new Date(timeoutChange.new);
            let durationMs = endDate - Date.now();
            let logEmbed = new EmbedBuilder()
            .setAuthor({name: targetUser.username, iconURL: targetUser.displayAvatarURL({extension:"png",size:2048})})
            .setTitle("Member Timeout")
            .setDescription(`**User:** ${targetUser.toString()}\n**Duration:** ${ms(Math.round(durationMs), {long:true})}\n**Reason:** ${auditEntry.reason || "No reason provided."}\n**Responsible moderator:** ${await client.users.fetch(auditEntry.executorId)}`)
            .setFooter({text: "ID: " + targetUser.id})
            .setTimestamp()
            .setColor("Orange");
            await logChannels.normal.send({embeds: [logEmbed], allowedMentions: {roles: [], parse: []}});
        } else if(!timeoutChange.new && timeoutChange.old) {
            let logEmbed = new EmbedBuilder()
            .setAuthor({name: targetUser.username, iconURL: targetUser.displayAvatarURL({extension:"png",size:2048})})
            .setTitle("Member Removed From Timeout")
            .setDescription(`**User:** ${targetUser.toString()}\n**Reason:** ${auditEntry.reason || "No reason provided."}\n**Responsible moderator:** ${await client.users.fetch(auditEntry.executorId)}`)
            .setFooter({text: "ID: " + targetUser.id})
            .setTimestamp()
            .setColor("DarkAqua");
            await logChannels.normal.send({embeds: [logEmbed], allowedMentions: {roles: [], parse: []}});
        }
    }

    async function messageBulkDeleteHandler(messages) {
        try {
            var messageData = [];
            var embedDescriptionData = [""];
            messages.each(message=>{
                if(config.excludeLogChannels.includes(message.channel.id)) return;
                var username = ">>UNKNOWN<<";
                try {
                    if(message.author.username) username = message.author.username;
                } catch(err) {};
                if(!message.content) return;
                messageData.unshift(`[${username}]: ${message.content}`);
            });
            if(messageData.length == 0) return;
            var i = 0;
            for(var message of messageData) {
                var newEmbedData = embedDescriptionData[i] + message + "\n";
                if(newEmbedData.length > 4000) {
                    i++;
                    embedDescriptionData[i] = message + "\n";
                    continue;
                }
                embedDescriptionData[i] = newEmbedData;
            }
            var embeds = [];
            await new Promise(resolve=>setTimeout(resolve,2500)); // give time for delete message event to finish
            for(var i in embedDescriptionData) {
                if(embedDescriptionData[i].length == 0) {
                    var description = "Unable to show message content in embed.";
                } else {
                    var description = embedDescriptionData[i];
                }
                let logEmbed = new EmbedBuilder()
                .setTitle(`${messages.size} Messages purged in #${messages.at(0).channel.name}`)
                .setDescription(description)
                .setFooter({text:`${messageData.length} latest shown`+(embedDescriptionData.length>1?` [${parseInt(i)+1}/${embedDescriptionData.length}]`:"")})
                .setTimestamp()
                .setColor("Red");
                await logChannels.normal.send({embeds: [logEmbed], allowedMentions: {roles: [], parse: []}});
            }
        } catch(err) {
            console.error(err);
            try {
                await logChannels.important.send("Failed to process purged message event.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            } catch(err) {}
        }
    }

    async function messageDeleteHandler(message) {
        try {
            if(message.author.bot) return;
            if(config.excludeLogChannels.includes(message.channel.id)) return;
            var description = `${message.content}\n\nMessage ID: ${message.id}`;
            if(message.attachments.size > 0) {
                description += "\nThis message also has " + message.attachments.size.toString() + " attachments that will be logged separately.";
            }
            let logEmbed = new EmbedBuilder()
            .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL({extension:"png",size:2048})})
            .setTitle(`Message deleted in #${message.channel.name}`)
            .setDescription(description)
            .setFooter({text:"ID: " + message.author.id})
            .setTimestamp()
            .setColor("Red");
            await logChannels.normal.send({embeds: [logEmbed], allowedMentions: {roles: [], parse: []}});
        } catch(err) {
            console.error(err);
            try {
                await logChannels.important.send("Failed to process message delete event.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            } catch(err) {};
        }
    }

    async function messageEditHandler(oldMessage, newMessage) {
        if(config.excludeLogChannels.includes(oldMessage.channel.id)) return;
        try {
        if(oldMessage.content == newMessage.content) return;
        if(newMessage.author.bot) return;
        let logEmbed = new EmbedBuilder()
        .setAuthor({name: newMessage.author.username, iconURL: newMessage.author.displayAvatarURL({extension:"png", size:2048})})
        .setTitle(`Message edited in #${newMessage.channel.name}`)
        .setDescription(`**Before:** ${oldMessage.content}\n**+After:** ${newMessage.content}`)
        .setFooter({text:"ID: " + newMessage.author.id})
        .setTimestamp()
        .setURL(newMessage.url)
        .setColor("Blue");
        await logChannels.normal.send({embeds: [logEmbed], allowedMentions: {roles: [], parse: []}});
        } catch(err) {
            console.error(err);
            try {
                await logChannels.important.send("Failed to process message update event.\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
            } catch(err) {};
        }
    }

    return {
        onReady
    }
}