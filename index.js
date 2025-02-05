const { Client, Events, GatewayIntentBits, EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const commandsDir = path.join(__dirname, 'commands');

client.on("messageCreate", async (message) => {
	if (!message.guild || message.author.bot) return;
	
	let args = message.content.split(" ");
    var commandName = args[0] ? args[0].slice(1) : "";
	await processWikiCommands(message);
	
	
	if (args[0] === ".create") {
		if (!message.member.roles.cache.some(role => role.name === "Staff")) {
			return message.reply("You do not have permission to create commands.");
		}

		/*
		if (args.length < 3) {
			return message.reply("Not enough arguments. Usage: `.create <command name> <command content>`");
		} */

		const creationButton = new ButtonBuilder()
			.setCustomId("creationButton")
			.setLabel("Start Command Creation?")
			.setStyle(ButtonStyle.Primary);
		
		const row = new ActionRowBuilder().addComponents(creationButton);

		return message.reply({components: [row]});
	}

	
	if (args[0] === ".delete") {
        let commandName = args[1];
		if (!message.member.roles.cache.some(role => role.name === "Staff")) {
			return message.reply("You do not have permission to delete commands.");
		}
		if (args.length < 2) {
			return message.reply("Not enough arguments. Usage: `.delete <command name>`");
		}
        commandName = path.basename(commandName);
        const filePath = path.join(commandsDir, `${commandName}.botcmd`);
        if (!filePath.startsWith(commandsDir)) {
            return message.reply("Invalid command path.");
        }
		fs.unlink(`./commands/${commandName}.botcmd`, (err) => {
			if (err) return message.reply(`Command ${commandName} does not exist.`);
			message.reply(`Command \`.${commandName}\` deleted!`);
		});
	}

	
	if (args[0] === ".help") {
		fs.readdir('./commands', (err, files) => {
			if (err) return message.reply("Error reading commands.");
			const commandList = files.filter(file => file.endsWith('.botcmd')).map(file => file.replace('.botcmd', '')).sort();
			message.reply("Commands: " + (commandList.length ? commandList.join(", ") : "None"));
		});
	}

	if (args[0].startsWith(".") && fs.existsSync(`./commands/${commandName}.botcmd`)) {
		fs.readFile(`./commands/${commandName}.botcmd`, 'utf8', async (err, commandContent) => {
            if (commandContent === "" || commandContent === null) {
                return message.reply("Command content is empty.");
            }
                if (err) return;
                try {
                    let data = JSON.parse(commandContent);
                    let embed = new EmbedBuilder();
                    if (data.author) embed.setAuthor({ name: data.author });
                    if (data.title) embed.setTitle(data.title);
                    if (data.color) {
                        var consoleColors = {
                            "3DS": 0xCE181E,
                            "WiiU": 0x009AC7,
                            "Switch": 0xE60012,
                            "Wii": 0x009AC7
                        }
                        if (data.color in consoleColors) {
                            embed.setColor(consoleColors[data.color]);
                        } else {
                            embed.setColor(parseInt(data.color,16));
                        }};
                    if (data.image) embed.setImage(data.image);
                    if (data.description) embed.setDescription(data.description);
                    if (data.footer) embed.setFooter({ text: data.footer });
                    if (data.url) embed.setURL(data.url);

                    if (message.reference) {
                        (await message.fetchReference()).reply({ embeds: [embed] });
                    } else {
                        message.channel.send({ embeds: [embed] });
                    }
                } catch {
                    if (message.reference) {
                        (await message.fetchReference()).reply(commandContent);
                    } else {
                        message.channel.send(commandContent);
                    }
                }
            });
	}

	if (message.content === ".test") {
		const embed = new EmbedBuilder().setDescription("This is a test message.");
		message.channel.send({ embeds: [embed] });
	}
});

//.create file creation
client.on('interactionCreate', async interaction => {

	// Creation Button Click
	if(interaction.isButton() && interaction.customId === "creationButton") {

        if (interaction.user.id !== interaction.user.id) {
            return interaction.reply({ content: "nice try", flags: MessageFlags.Ephemeral });
        }

		
		const commandCreationPopUp = new ModalBuilder()
			.setCustomId("commandCreationPopUp")
			.setTitle("Command Creation");

		const commandName = new TextInputBuilder()
			.setCustomId("commandName")
			.setLabel("Command Name:")
			.setStyle(TextInputStyle.Short);

		const commandDescription = new TextInputBuilder()
			.setCustomId("commandDescription")
			.setLabel("Description of Command When Using `help`:")
			.setStyle(TextInputStyle.Short);

		const commandContent = new TextInputBuilder()
			.setCustomId("commandContent")
			.setLabel("Command Content:")
			.setStyle(TextInputStyle.Paragraph);

		const commandCreationPopUpName = new ActionRowBuilder().addComponents(commandName);
		const commandCreationPopUpDescription = new ActionRowBuilder().addComponents(commandDescription);
		const commandCreationPopUpContent = new ActionRowBuilder().addComponents(commandContent);

		commandCreationPopUp.addComponents(commandCreationPopUpName, commandCreationPopUpDescription, commandCreationPopUpContent);

		console.log(commandCreationPopUp);
		await interaction.showModal(commandCreationPopUp);
	}

	// Creation Modal Submission
	if(interaction.isModalSubmit() && interaction.customId === "commandCreationPopUp") {

		const commandName = interaction.fields.getTextInputValue("commandName");
		const commandDescription = interaction.fields.getTextInputValue("commandDescription");
		const commandContent = interaction.fields.getTextInputValue("commandContent");
 
		const fileContents = JSON.stringify({"commandName": commandName, "commandDescription": commandDescription, "commandContent": commandContent}, null, 2);
		const filePath = path.join(commandsDir, `${commandName}.botcmd`);
		
		if (["create", "delete", "help", "."].includes(commandName) || /[^\x00-\x7F]/.test(commandName) || (commandName.startsWith(".") || commandName === "")) {
			return interaction.reply("You can't create a command with that name.");
		}

		if (!filePath.startsWith(commandsDir)) {
			return interaction.reply("Invalid command path.");
		}

		fs.writeFile(`./commands/${commandName}.botcmd`, fileContents, (err) => {
			if (err) return interaction.reply("Error saving command.");
				interaction.reply(`Command \`.${commandName}\` created!`);
			});
	}
	return;
});


client.once(Events.ClientReady, () => {
	console.log('Ready! Logged in as ' + client.user.tag);
    const commandsDir = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true });
    }
});

client.login(config.token);

async function generateWikiPage(wikiCommand) {
	if (!wikiCommand.length) return;
	wikiCommand = wikiCommand[0].toUpperCase() + wikiCommand.slice(1).replace(/ /g, "_");
	let response = await fetch(`https://wiki.hacks.guide/w/api.php?action=query&meta=siteinfo&siprop=general&iwurl=true&titles=${encodeURIComponent(wikiCommand.split("#")[0])}&format=json`).then(res => res.json());
	if (response.query?.interwiki?.[0]?.url) return `<${response.query.interwiki[0].url}>`;
	if (response.query?.normalized?.[0]?.to) wikiCommand = response.query.normalized[0].to;
	return `<https://wiki.hacks.guide/wiki/${wikiCommand}>`;
}

async function processWikiCommands(message) {
	let botMessage = "";
	let currentMessageContent = message.content;
	let numLooped = 0;

	while (currentMessageContent.includes("[[") && numLooped < 10) {
		let wikiCommandStart = currentMessageContent.split("[[").slice(1).join("[[");
		if (!wikiCommandStart.includes("]]")) return;
		let wikiCommand = wikiCommandStart.split("]]")[0];
		let wikiURL = await generateWikiPage(wikiCommand);
		if (!wikiURL) return;
		botMessage += (botMessage ? ", " : "") + wikiURL;
		currentMessageContent = wikiCommandStart.split("]]").slice(1).join("]]");
		numLooped++;
	}
	if (!botMessage) return;
	botMessage = `Link${numLooped > 1 ? "s" : ""}: ${botMessage}`;
	if (message.reference) {
		(await message.fetchReference()).reply(botMessage);
	} else {
		message.channel.send(botMessage);
	}
}
