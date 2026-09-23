.mode column
.header on
PRAGMA foreign_keys = ON;

-- Create emptysd command
INSERT INTO command_nodes (id, type) VALUES (1, 'command');
INSERT INTO commands (node_id, description) VALUES (1, 'How to redo CFW setup when the SD card is empty');
INSERT INTO command_nodes (id, parent_id, type) VALUES (2, 1, 'commandname');
INSERT INTO command_names (node_id, name, primary_name) VALUES (2, 'emptysd', true);

-- Create '3ds' console
INSERT INTO command_nodes (id, parent_id, type) VALUES (3, 1, 'console');
INSERT INTO command_consoles (node_id) VALUES (3);
INSERT INTO command_nodes (id, parent_id, type) VALUES (4, 3, 'consolename');
INSERT INTO command_console_names (node_id, name) VALUES (4, '3ds');

-- Create embed

INSERT INTO command_nodes (id, parent_id, type) VALUES (5, 3, 'embed');
INSERT INTO embed_data (node_id, title, description) VALUES (5, 'Empty SD card on a modded 3DS', 'https://3ds.hacks.guide/restoring-updating-cfw.html');

-- Create bluehax command
INSERT INTO command_nodes (id, type) VALUES (6, 'command');
INSERT INTO commands (node_id, description) VALUES (6, 'Sends the bluehax site for SOAP transfer information');
INSERT INTO command_nodes (id, parent_id, type) VALUES (7, 6, 'commandname');
INSERT INTO command_names (node_id, name, primary_name) VALUES (7, 'bluehax', true);
INSERT INTO command_nodes (id, parent_id, type) VALUES (8, 6, 'commandname');
INSERT INTO command_names (node_id, name, primary_name) VALUES (8, 'soap', false);

-- Create text

INSERT INTO command_nodes (id, parent_id, type) VALUES (9, 6, 'text');
INSERT INTO command_text (node_id, content) VALUES (9, 'https://bluehax.xyz');

-- someone sends .emptysd 3ds
-- check for emptysd command.
SELECT node_id FROM command_names WHERE name='emptysd'; -- 'emptysd' is user input
-- outputs 2

-- get parent node id (command node)
SELECT parent_id FROM command_nodes WHERE id=2; -- 2 is last command output
-- outputs 1

-- search for embeds
SELECT id FROM command_nodes WHERE parent_id=1 AND type='embed'; -- 1 is last command output
-- no output

-- search for text
SELECT id FROM command_nodes WHERE parent_id=1 AND type='text';
-- no output

-- search for consoles
SELECT id FROM command_nodes WHERE parent_id=1 AND type='console';
-- outputs 3

-- get console name nodes
SELECT id FROM command_nodes WHERE parent_id=3 AND type='consolename';
-- output 4

-- find console name
SELECT node_id FROM command_console_names WHERE node_id IN (4) AND name='3ds';
-- output 4 (any output means success! therefore 3 is the console)

-- search for embeds inside console
SELECT id FROM command_nodes WHERE parent_id=3 AND type='embed';
-- output 5

-- get embed data
SELECT * from embed_data WHERE node_id=5;

.print "Getting command name"
WITH name_ids AS (SELECT id from command_nodes WHERE parent_id=1 AND type='commandname')
SELECT name FROM command_names WHERE node_id IN name_ids and primary_name=true;