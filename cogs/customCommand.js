var util = require("../util");
var getCommandList, getCommandDataNodes, getConsoleNodes, getConsoleNamesForConsole, getCmdNodeIdFromName, getTextData, getEmbedData;
var db;

module.exports = (client, logChannels, config, botContext) => {
    if(botContext) {
    db = botContext.db;
    db.exec(`
        CREATE TABLE IF NOT EXISTS command_nodes (
            id INTEGER PRIMARY KEY,
            parent_id INTEGER,
            type TEXT NOT NULL CHECK ( type IN ('command', 'console', 'consolename', 'embed', 'commandname', 'text') ),
            FOREIGN KEY (parent_id) REFERENCES command_nodes(id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS commands (
            node_id INTEGER PRIMARY KEY,
            description TEXT,
            off_topic BOOL DEFAULT false,
            FOREIGN KEY (node_id) REFERENCES command_nodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS command_consoles (
            node_id INTEGER PRIMARY KEY,
            FOREIGN KEY (node_id) REFERENCES command_nodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS command_console_names (
            node_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            FOREIGN KEY (node_id) REFERENCES command_nodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS embed_data (
            node_id INTEGER PRIMARY KEY,
            author TEXT,
            title TEXT,
            color TEXT,
            image TEXT,
            description TEXT,
            footer TEXT,
            url TEXT,
            off_topic BOOL DEFAULT false,
            FOREIGN KEY (node_id) REFERENCES command_nodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS command_text (
            node_id INTEGER PRIMARY KEY,
            content TEXT,
            off_topic BOOL DEFAULT false,
            FOREIGN KEY (node_id) REFERENCES command_nodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS command_names (
            node_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            primary_name BOOL NOT NULL DEFAULT false,
            FOREIGN KEY (node_id) REFERENCES command_nodes(id) ON DELETE CASCADE
        );
    `);
    
    getCommandList = db.prepare(`
        SELECT command_nodes.parent_id id, command_names.name, commands.description, commands.off_topic
        FROM command_names
        JOIN command_nodes ON command_nodes.id = command_names.node_id
        JOIN commands ON commands.node_id = command_nodes.parent_id
        WHERE command_names.primary_name = 1;
    `);

    getCommandDataNodes = db.prepare(`
        SELECT id,type FROM command_nodes WHERE parent_id=? AND type in ('text','embed');
    `);
        
    getConsoleNodes = db.prepare(`
        SELECT id FROM command_nodes WHERE parent_id=? AND type='console';    
    `);

    getConsoleNamesForConsole = db.prepare(`
        SELECT command_console_names.name
        FROM command_console_names
        JOIN command_nodes ON command_console_names.node_id = command_nodes.id
        WHERE command_nodes.parent_id = ?
    `);

    getCmdNodeIdFromName = db.prepare(`
        SELECT command_nodes.parent_id
        FROM command_nodes
        JOIN command_names ON command_names.node_id = command_nodes.id
        WHERE command_names.name = ?
    `);

    getTextData = db.prepare(`
        SELECT * from command_text WHERE node_id = ?
    `);

    getEmbedData = db.prepare(`
        SELECT * from embed_data WHERE node_id = ?
    `);
    }

    function searchDataNode(parentId) {
        var cmdDataNodes = getCommandDataNodes.all(parentId);
        if(!cmdDataNodes || !cmdDataNodes.length) return false;
        var dataNodeInfo;
        if(cmdDataNodes.length == 1) {
            dataNodeInfo = cmdDataNodes[0];
        } else {
            dataNodeInfo = cmdDataNodes[~~(Math.random() * cmdDataNodes.length)];
        }
        return dataNodeInfo;
    }


    return {
        searchDataNode,
        getCommandList,
        getConsoleNodes,
        getConsoleNamesForConsole,
        getCmdNodeIdFromName,
        getTextData,
        getEmbedData
    }
}