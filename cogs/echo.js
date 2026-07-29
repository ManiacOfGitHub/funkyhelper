var util = require('../util');
var {EmbedBuilder} = require("discord.js");
var commandList = ["echo", "say", "echobypass", "saybypass", "reply", "replybypass", "edit", "editbypass"]

module.exports = (client, logChannels, config) => {
    async function onCommand(command, args, message) {
 	    if(!commandList.includes(command)) return;
		var bypassMode = command.endsWith("bypass");
		if(bypassMode) {
			if(!util.hasRole(message.member, config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
				return message.reply("no");
			}
		} else {
			if (!util.hasRole(message.member, config.staffRoleList)) {
				return message.reply("no");
			}
        }

        let channel, channelId, messageId, messageToUse, sliceAt

        if (args.length === 1) return message.reply("Not enough arguments");
        if (["echo", "say", "echobypass", "saybypass"].includes(command)) {
		    channelId = args[1].matchAll(/\d/g).toArray().join("");
		    if(channelId) {
			    try {
				    channel = await message.guild.channels.fetch(channelId);
                    if (args.length < 3) return message.reply("Not enough arguments");
                    channelId = channel.id;
			        sliceAt = 2;
			    } catch { // this makes it work when pinging at the start for some reason
                    if (args.length < 2) return message.reply("Not enough arguments");
    		            channelId = message.channel.id;
        		    channel = await message.guild.channels.fetch(channelId);
		            sliceAt = 1;
                }
            } else {
                if (args.length < 2) return message.reply("Not enough arguments");
		        channelId = message.channel.id;
    		    channel = await message.guild.channels.fetch(channelId);
		        sliceAt = 1;
            }
               

		} else {
            var autoMode = !!message.reference;
		    if(args.length < (autoMode ? 2 : 4)) return message.reply("Not enough arguments");
		    sliceAt = autoMode ? 2 : 4;
            if (!autoMode) {
               	channelId = args[1].matchAll(/\d/g).toArray().join("");
                messageId = args[2].matchAll(/\d/g).toArray().join("");
                try {
				    channel = await message.guild.channels.fetch(channelId);
				    messageToUse = await channel.messages.fetch(messageId);
                } catch (err) {
                    if (!channel) {return message.reply("No valid channel provided.");
                    } else if (!messageToUse) {return message.reply("No valid message provided.");
                    }
                }
                sliceAt = 3;
		    } else {
                channel = message.channel;
                messageId = (await message.fetchReference());
                channelId = message.channel.id; 
                messageToUse = await channel.messages.fetch(messageId);
                sliceAt = 1;
            }
        }
        
        if (["edit", "editbypass"].includes(command)) {
            if(messageToUse.author.id != client.user.id) {
			await message.reply("Message was not sent by bot.");
			return;
		    }
		var oldContent = messageToUse.content;
        }
	
		if((!config.echoChannelIds.includes(channelId)) && !util.hasRole(message.member, config.moderatorRole) && !config.botOwners.includes(message.member.id)) {
			await message.reply(`You cannot \`.${command}\` into ${sliceAt==1?"this":"that"} channel. You can \`.${command}\` into: ${config.echoChannelIds.map(o=>`<#${o}>`).join(", ")}`);
			return;
		}	
		try {
            if (["echo", "say", "echobypass", "saybypass"].includes(command)) {
			    if(bypassMode) {
				    var sentMessage = await channel.send({content:args.slice(sliceAt).join(" "),allowedMentions:{parse:['roles','users','everyone']}});
			    } else {
				    var sentMessage = await channel.send(args.slice(sliceAt).join(" "));
			    }
            } else if (["reply", "replybypass"].includes(command)) {
                if(bypassMode) {
				    var sentMessage = await messageToUse.reply({content:args.slice(sliceAt).join(" "),allowedMentions:{parse:['roles','users','everyone'],repliedUser:true}});
			    } else {
				    var sentMessage = await messageToUse.reply({content:args.slice(sliceAt).join(" "),allowedMentions:{repliedUser: false}});
			    }
            } else {
                if(bypassMode) {
				    await messageToUse.edit({content:args.slice(sliceAt).join(" "),allowedMentions:{parse:['roles','users','everyone'],repliedUser:true}});
			    } else {
				    await messageToUse.edit({content:args.slice(sliceAt).join(" "),allowedMentions:{parse: ['users'], repliedUser: false}});
			    } 
            }
            
			let logEmbed = new EmbedBuilder();
			logEmbed.setAuthor({name:message.member.user.username,iconURL:message.member.displayAvatarURL({extension:"png",size:2048})});
			logEmbed.setTimestamp();
            if (["edit", "editbypass"].includes(command)) {
			    logEmbed.setTitle(`.${command} was used to edit a message`);
			    logEmbed.setDescription(`Edited [a message](${messageToUse.url}) in <#${channelId}>:\n**Old Content:** ${oldContent}\n**New Content:** ${args.slice(sliceAt).join(" ")}`);
			    logEmbed.setFooter({text:"ID: " + messageToUse.id});
            } else {
			    logEmbed.setTitle(`.${command} was used to send a message`);
			    logEmbed.setDescription(`Sent [a message](${sentMessage.url}) in <#${channelId}>:\n${args.slice(sliceAt).join(" ")}`);
			    logEmbed.setFooter({text:"ID: " + sentMessage.id});
            }
			await logChannels.important.send({embeds: [logEmbed],allowedMentions:{parse:[]}});
		} catch(err) {
			console.error(err);
			await logChannels.important.send("Failed to send message (does the bot have permission to speak there?)\nError info: " + (err?(err.message??"syke lmao"):"syke lmao"));
		}
		try {
			await message.delete();
		} catch(err) {
			//I really don't care enough to do anything with this.
		}
        return;
    
	}	
    return {
        onCommand,
		commandList
    }
}