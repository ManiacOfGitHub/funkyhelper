const {REST, Routes, SlashCommandBuilder } = require("discord.js");
var util = require('../util');
var fs = require('fs');
const e = require("express");
const { json } = require("stream/consumers");
const { descCharArr } = require("scribe.js-ocr/js/utils/miscUtils");
var db, customCommand;

module.exports = (client, logChannels, config, botContext) => {
    async function onReady() {
        await botContext.customCommandCogLoaded;
        customCommand = botContext.customCommandCog;
        db = botContext.db;
    }

    async function customRedeployCmdHandler(isSlash, params, ctx) {
        var reply = util.ctxReplier(ctx, isSlash);
        if(isSlash) await ctx.deferReply();
        if(!config.botOwners.includes(isSlash ? ctx.user.id : ctx.author.id)) {
            await reply("no");
            return;
        }
        var commands = customCommand.getCommandList.all();
        var slashCommands = [];
        if(!commands || commands.length == 0) return;
        for(var command in commands) {
            var consoles = [];
            if (!customCommand.searchDataNode(commands[command].id)) {
                var consoleNodeIds = customCommand.getConsoleNodes.all(commands[command].id).map(o=>o.id);
                if(!consoleNodeIds || !consoleNodeIds.length) continue;
                for(var consoleNodeId of consoleNodeIds) {
                    consoles.push(...customCommand.getConsoleNamesForConsole.all(consoleNodeId).map(o=>o.name));
                }
            };
            let slashCommand = new SlashCommandBuilder().setName(commands[command].name).setDescription(commands[command].description);
            if(consoles.length > 0) {
                console.log(...consoles.map(console=>({name:console, value:console})));
                slashCommand.addStringOption((option)=>
                    option.setName("parameter").setDescription("Required if not in a channel that is related to the command.").addChoices(...consoles.map(console=>({name:console, value:console}))).setRequired(false)
                );
            }
            slashCommands.push(slashCommand);
        }
        await reply("Command data has loaded! Deploying with Discord API...");
        console.log("Command data has loaded! Deploying with Discord API...");

        var rest = new REST().setToken(config.token);
        try {
            await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {body: slashCommands});
        } catch(err) {
            await reply("An error occurred while deploying commands.");
            console.log("An error occurred while deploying commands:");
            console.error(err);
            return;
        }

        await reply("All guild (custom) commands were successfully deployed!");
        console.log("All guild (custom) commands were successfully deployed!");
    }

    async function migrateCmdHandler(isSlash, params, ctx) {
        var reply = util.ctxReplier(ctx, isSlash);
        if (!util.hasRole(ctx.member, config.allowRoleList)) return reply("no");
        if(isSlash) await ctx.deferReply();
        if (!fs.existsSync(`./commands/${params.command}.botcmd`)) return reply("Prefix command does not exist, cannot migrate.");
        
        var log = "";
        var cmdNodeId = customCommand.getCmdNodeIdFromName.get(params.command);
        if(cmdNodeId) {
            log += "Command already exists in new system, overwriting...\n";
            db.prepare(`DELETE FROM command_nodes WHERE id = ?`).run(cmdNodeId.id);
        }

        var files = fs.readdirSync(`./alias/`);
        var cmdAliases = [];
        for(var alias of files) {
            if(!alias.endsWith(".alias")) continue;
            if(fs.readFileSync(`./alias/${alias}`, "utf8") == params.command) {
                cmdAliases.push(alias.replace(".alias",""));
            }
        }
        if(cmdAliases.length) {
            log += "Found aliases: " + cmdAliases.join(", ") + "\n";
        } else {
            log += "No aliases found.\n";
        }

        var commandContent = fs.readFileSync(`./commands/${params.command}.botcmd`, 'utf8');
        

        db.transaction(()=>{
            let info = db.prepare(`INSERT INTO command_nodes (type) VALUES ('command')`).run();
            var cmdNodeId = info.lastInsertRowid;
            console.log(cmdNodeId);
            db.prepare(`INSERT INTO commands (node_id, description) VALUES (?, ?)`).run(cmdNodeId, params.description);
            info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'commandname')`).run(cmdNodeId);
            db.prepare(`INSERT INTO command_names (node_id, name, primary_name) VALUES (?, ?, 1)`).run(info.lastInsertRowid, params.command);
            for(var alias of cmdAliases) {
                info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'commandname')`).run(cmdNodeId);
                db.prepare(`INSERT INTO command_names (node_id, name, primary_name) VALUES (?, ?, 0)`).run(info.lastInsertRowid, alias);
            }

            var isText = false;
            var jsonData;
            try {
                if(!commandContent.startsWith("`") && !commandContent.endsWith("`")) {
                    throw Error();
                }
                jsonData = JSON.parse(commandContent.slice(1, -1));
            } catch(err) {
                isText = true;
            }

            if(isText) {
                log += "Pure text data. Adding command...\n"
                info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'text')`).run(cmdNodeId);
                if(commandContent.toLowerCase().startsWith("offtopic ")) {
                    db.prepare(`INSERT INTO command_text (node_id, content, off_topic) VALUES (?, ?, 1)`).run(info.lastInsertRowid, commandContent.split(" ").slice(1).join(" "));
                } else {
                    db.prepare(`INSERT INTO command_text (node_id, content, off_topic) VALUES (?, ?, 0)`).run(info.lastInsertRowid, commandContent);
                }
            } else if(jsonData.consoles) {
                log += "Consoles property detected. Adding all parameters...\n";
                for(let consoleId in jsonData.consoles) {
                    info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'console')`).run(cmdNodeId);
                    let consoleNodeId = info.lastInsertRowid;
                    db.prepare(`INSERT INTO command_consoles (node_id) VALUES (?)`).run(consoleNodeId);
                    if(jsonData.consoleMaps && jsonData.consoleMaps.hasOwnProperty(consoleId)) {
                        log += `Parameter ${consoleId} is actually a map. Map includes: ${jsonData.consoleMaps[consoleId].join(", ")}. Adding it...\n`;
                        for(let consoleName of jsonData.consoleMaps[consoleId]) {
                            info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'consolename')`).run(consoleNodeId);
                            db.prepare(`INSERT INTO command_console_names (node_id, name) VALUES (?, ?)`).run(info.lastInsertRowid, consoleName);
                        }
                    } else {
                        log += `Adding parameter ${consoleId}...`;
                        info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'consolename')`).run(consoleNodeId);
                        db.prepare(`INSERT INTO command_console_names (node_id, name) VALUES (?, ?)`).run(info.lastInsertRowid, consoleId);
                    }
                    
                    let commandContent = jsonData.consoles[consoleId];
                    let isText = typeof(commandContent) == "string";
                    let newJsonData = commandContent;
                    if(isText) {
                        log += "Adding text data...\n";
                        info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'text')`).run(consoleNodeId);
                        if(commandContent.toLowerCase().startsWith("offtopic ")) {
                            db.prepare(`INSERT INTO command_text (node_id, content, off_topic) VALUES (?, ?, 1)`).run(info.lastInsertRowid, commandContent.split(" ").slice(1).join(" "));
                        } else {
                            db.prepare(`INSERT INTO command_text (node_id, content, off_topic) VALUES (?, ?, 0)`).run(info.lastInsertRowid, commandContent);
                        }
                    } else {
                        log += "Adding embed data...\n";
                        info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'embed')`).run(consoleNodeId);
                        let data = {
                            author: newJsonData.author,
                            title: newJsonData.title,
                            color: newJsonData.color,
                            image: newJsonData.image,
                            description: newJsonData.description,
                            footer: newJsonData.footer,
                            url: newJsonData.url,
                            off_topic: Number(newJsonData.offTopic)
                        };
                        console.log(`INSERT INTO embed_data (node_id, ${Object.keys(data).join(", ")}) VALUES (?, ${Array(Object.keys(data).length).fill("?").join(", ")})`);
                        console.log(info.lastInsertRowid, ...Object.values(data));
                        db.prepare(`INSERT INTO embed_data (node_id, ${Object.keys(data).join(", ")}) VALUES (?, ${Array(Object.keys(data).length).fill("?").join(", ")})`).run(info.lastInsertRowid, ...Object.values(data));
                        console.log(1);
                    }
                }

            } else if(jsonData.random) {
                log += "Random property detected. Adding all properties...\n";
                for(let commandContent of jsonData.random) {
                    let isText = false;
                    let jsonData;
                    try {
                        if(!commandContent.startsWith("`") && !commandContent.endsWith("`")) {
                            throw Error();
                        }
                        jsonData = JSON.parse(commandContent.slice(1, -1));
                    } catch(err) {
                        isText = true;
                    }
                    if(isText) {
                        log += "Adding text data to random list...\n";
                        info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'text')`).run(cmdNodeId);
                        if(commandContent.toLowerCase().startsWith("offtopic ")) {
                            db.prepare(`INSERT INTO command_text (node_id, content, off_topic) VALUES (?, ?, 1)`).run(info.lastInsertRowid, commandContent.split(" ").slice(1).join(" "));
                        } else {
                            db.prepare(`INSERT INTO command_text (node_id, content, off_topic) VALUES (?, ?, 0)`).run(info.lastInsertRowid, commandContent);
                        }
                    } else {
                        log += "Adding embed data to random list...\n";
                        info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'embed')`).run(cmdNodeId);
                        let data = {
                            author: jsonData.author,
                            title: jsonData.title,
                            color: jsonData.color,
                            image: jsonData.image,
                            description: jsonData.description,
                            footer: jsonData.footer,
                            url: jsonData.url,
                            off_topic: Number(jsonData.offTopic)
                        };
                        db.prepare(`INSERT INTO embed_data (node_id, ${Object.keys(data).join(", ")}) VALUES (?, ${Array(Object.keys(data).length).fill("?").join(", ")})`).run(info.lastInsertRowid, ...Object.values(data));
                    }
                }

            } else {
                log += "Pure embed data. Adding command...\n";
                info = db.prepare(`INSERT INTO command_nodes (parent_id, type) VALUES (?, 'embed')`).run(cmdNodeId);
                let data = {
                    author: jsonData.author,
                    title: jsonData.title,
                    color: jsonData.color,
                    image: jsonData.image,
                    description: jsonData.description,
                    footer: jsonData.footer,
                    url: jsonData.url,
                    off_topic: Number(jsonData.offTopic)
                };
                db.prepare(`INSERT INTO embed_data (node_id, ${Object.keys(data).join(", ")}) VALUES (?, ${Array(Object.keys(data).length).fill("?").join(", ")})`).run(info.lastInsertRowid, ...Object.values(data));
            }
        })();

        if(cmdAliases.length) {
            log += "Deleting old aliases...\n";
            for(var alias of cmdAliases) {
                fs.unlinkSync(`./alias/${alias}.alias`);
            }
        }
        log += "Deleting old command...\n";
        fs.unlinkSync(`./commands/${params.command}.botcmd`);


        log += "Complete!";
        await reply(log);
    }

    return {
        commands: {
            customredeploy: {
                prefix: {
                    name: "customredeploy",
                    aliases: ["redeploycustom"]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("customredeploy")
                    .setDescription("Redeploys all of the guild-only custom commands, Bot Owner only")
                },
                handler: customRedeployCmdHandler
            },
            migrate: {
                prefix: {
                    name: "migrate",
                    params: [
                        {
                            name: "command",
                            type: "text"
                        },
                        {
                            name: "description",
                            type: "longtext"
                        }
                    ]
                },
                slash: {
                    data: new SlashCommandBuilder()
                    .setName("migrate")
                    .setDescription("Migrates a command to the new custom command system")
                    .addStringOption(option=>option.setName("command").setDescription("Name of the command to migrate").setRequired(true))
                    .addStringOption(option=>option.setName("description").setDescription("Description in slash command").setRequired(true))
                },
                handler: migrateCmdHandler
            }
        },
        onReady,
        noAwait: true
    }
}