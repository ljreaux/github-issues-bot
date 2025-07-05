import {
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";
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

const REPO_OPTIONS = [
  { label: "MeadTools", value: "meadtools" },
  { label: "Taplist", value: "meadtools-taplist" },
  { label: "Desktop", value: "meadtools-desktop" },
];

const contextCache = new Map<string, string>();

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
    const messageLink = `https://discord.com/channels/${interaction.guildId}/${targetMessage.channelId}/${targetMessage.id}`;
    let content = targetMessage.content ? `> ${targetMessage.content}` : "";
    const attachmentUrls: string[] = [];

    for (const attachment of targetMessage.attachments.values()) {
      const type = attachment.contentType ?? "";

      if (type.startsWith("image/")) {
        attachmentUrls.push(
          `\n![${attachment.description || "image"}](${attachment.url})`
        );
      } else if (type.startsWith("video/")) {
        attachmentUrls.push(
          `\n[📹 ${attachment.description || "Watch video"}](${attachment.url})`
        );
      } else {
        attachmentUrls.push(
          `\n[📎 ${attachment.description || "Download file"}](${attachment.url})`
        );
      }
    }

    content += `\n\n${attachmentUrls.join("")}\n\n[Original Message](${messageLink})`;

    const type = commandName.includes("feature") ? "feature" : "bug";
    contextCache.set(interaction.id, JSON.stringify({ type, content }));

    const select = new StringSelectMenuBuilder()
      .setCustomId(`select_repo:${interaction.id}`)
      .setPlaceholder("Choose a repository")
      .addOptions(REPO_OPTIONS);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select
    );

    await interaction.reply({
      content: "Select a repository for this issue:",
      components: [row],
      ephemeral: true,
    });
  } else if (interaction.isStringSelectMenu()) {
    const [_, contextId] = interaction.customId.split(":");
    const selectedRepo = interaction.values[0];

    const stored = contextCache.get(contextId);
    if (!stored) {
      return interaction.reply({
        content: "Context expired or missing.",
        ephemeral: true,
      });
    }

    const { type, content } = JSON.parse(stored);

    const modal = getModal(type, content, selectedRepo);
    await interaction.showModal(modal);
  } else if (interaction.isModalSubmit()) {
    const [customType, repo] = interaction.customId.split(":");
    const issueTitle = interaction.fields.getField("issueTitle").value;
    const issueDescription =
      interaction.fields.getField("issueDescription").value;
    const labels = [customType === "featureModal" ? "enhancement" : "bug"];

    const octokit = new Octokit({
      auth: process.env.GITHUB_ACCESS_TOKEN,
      baseUrl: "https://api.github.com",
    });

    const result = await octokit.rest.issues.create({
      owner: process.env.GITHUB_USERNAME || "",
      repo,
      title: issueTitle,
      body: issueDescription,
      labels,
    });

    await interaction.reply(`Issue created: ${result.data.html_url}`);
  }
});

client.login(process.env.BOT_TOKEN);

app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  if (event === "issues" && payload.action === "closed") {
    const body = payload.issue.body || "";
    const match = body.match(
      /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/
    );

    if (match) {
      const [, , channelId, messageId] = match;
      const channel = await client.channels.fetch(channelId);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(messageId);
        await message.reply(`GitHub issue closed: ${payload.issue.html_url}`);
      }
    }
  }

  res.status(200).send("ok");
});
