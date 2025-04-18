import { Client } from "discord.js";
import { Octokit } from "@octokit/rest";
import { getModal } from "./utils";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Github issues bot!");
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

const client = new Client({
  intents: ["Guilds", "GuildMessages"],
});

client.on("ready", () => {
  console.log("issue bot ready");
  const guildId = process.env.GUILD_ID || "";

  const guild = client.guilds.cache.get(guildId);

  const commands = guild ? guild.commands : client.application?.commands;

  const newCommands = [
    {
      name: "Create bug report",
      type: 3,
    },
    {
      name: "Create feature request",
      type: 3,
    },
  ];

  newCommands.forEach((com) => {
    commands?.create(com);
  });
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isMessageContextMenuCommand()) {
    const { commandName, targetMessage } = interaction;
    if (commandName === "Create bug report") {
      const modal = getModal("bug", targetMessage.content);
      interaction.showModal(modal);
    } else if (commandName === "Create feature request") {
      const modal = getModal("feature", targetMessage.content);
      interaction.showModal(modal);
    }
  } else if (interaction.isModalSubmit()) {
    const { fields } = interaction;
    const issueTitle = fields.getField("issueTitle").value;
    const issueDescription = fields.getField("issueDescription").value;

    const labels = [
      interaction.customId === "featureModal" ? "enhancement" : "bug",
    ];
    console.log(labels);
    const octokit = new Octokit({
      auth: process.env.GITHUB_ACCESS_TOKEN,
      baseUrl: "https://api.github.com",
    });

    octokit.rest.issues
      .create({
        owner: process.env.GITHUB_USERNAME || "",
        repo: process.env.GITHUB_REPOSITORY || "",
        title: issueTitle,
        body: issueDescription,
        labels,
      })
      .then((res) => {
        interaction.reply(`Issue created: ${res.data.html_url}`);
      });
  }
});

client.login(process.env.BOT_TOKEN);
