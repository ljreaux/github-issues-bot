import { Client, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { Octokit } from "@octokit/rest";
import { getModal, reloadCommands } from "./utils";
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { commandMap } from "./slashCommands";
import { yeastInfoAutocomplete } from "./commands/yeastInfo";
import { releaseAnnouncement } from "./releaseNotes";

const app = express();
const PORT = process.env.PORT || 3000;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const GITHUB_WEBHOOK_REPOSITORY =
  process.env.GITHUB_WEBHOOK_REPOSITORY || "ljreaux/MeadTools";

type WebhookRequest = express.Request & { rawBody?: Buffer };

app.use(
  express.json({
    verify: (req, _res, buffer) => {
      (req as WebhookRequest).rawBody = Buffer.from(buffer);
    },
  })
);

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

const TRANSLATION_REVIEW_LABEL = "translation-review";
const GERMAN_CHANNEL_ID = "1383877767116095638";
const RIZZEK_USER_ID = "189376145639211008";
const RELEASE_NOTES_CHANNEL_ID =
  process.env.RELEASE_NOTES_CHANNEL_ID || "1196106911540584458";
const TRANSLATION_BATCH_MARKER = /<!-- translation-review:source-[a-f0-9]+:commit-[a-f0-9]+ -->/i;
const deliveryCache = new Map<string, number>();
const announcedReleaseIds = new Set<number>();
const DELIVERY_CACHE_TTL_MS = 10 * 60 * 1000;

const contextCache = new Map<string, string>();

function hasValidWebhookSignature(req: WebhookRequest) {
  if (!GITHUB_WEBHOOK_SECRET || !req.rawBody) return false;

  const signature = req.get("x-hub-signature-256");
  if (!signature) return false;

  const expected = `sha256=${createHmac("sha256", GITHUB_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function hasSeenDelivery(deliveryId: string) {
  const now = Date.now();
  for (const [id, receivedAt] of deliveryCache) {
    if (now - receivedAt > DELIVERY_CACHE_TTL_MS) {
      deliveryCache.delete(id);
    }
  }

  return deliveryCache.has(deliveryId);
}

function isTranslationReviewIssue(payload: any) {
  if (payload?.repository?.full_name !== GITHUB_WEBHOOK_REPOSITORY) {
    return false;
  }

  return (payload.issue?.labels || []).some(
    (label: { name?: string }) => label.name === TRANSLATION_REVIEW_LABEL
  );
}

async function sendTranslationReviewNotification(issueUrl: string) {
  const channel = await client.channels.fetch(GERMAN_CHANNEL_ID);
  if (!channel?.isTextBased()) {
    throw new Error(`Discord channel ${GERMAN_CHANNEL_ID} is not text based.`);
  }

  await channel.send(
    `<@${RIZZEK_USER_ID}> Translation review requested: ${issueUrl}`
  );
}

async function sendReleaseAnnouncement(messages: string[]) {
  const channel = await client.channels.fetch(RELEASE_NOTES_CHANNEL_ID);
  if (!channel?.isTextBased() || !("send" in channel)) {
    throw new Error(`Discord channel ${RELEASE_NOTES_CHANNEL_ID} cannot receive messages.`);
  }

  for (const content of messages) {
    await channel.send({ content, allowedMentions: { parse: [] } });
  }
}

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
  if (interaction.isAutocomplete() && interaction.commandName === "yeastinfo") {
    return yeastInfoAutocomplete(interaction);
  }

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
  } else if (interaction.isChatInputCommand()) {
    const commandName = interaction.commandName;
    const command = commandMap[commandName];
    if (command) {
      await command.fn(interaction);
    }
  }
});

client.login(process.env.BOT_TOKEN).then(async () => {
  await reloadCommands();
});

app.post("/github-webhook", async (req, res) => {
  const webhookRequest = req as WebhookRequest;
  const deliveryId = req.get("x-github-delivery");

  if (!hasValidWebhookSignature(webhookRequest)) {
    console.warn(`Rejected GitHub webhook delivery ${deliveryId || "(unknown)"}.`);
    return res.status(401).send("invalid webhook signature");
  }

  if (deliveryId && hasSeenDelivery(deliveryId)) {
    return res.status(200).send("duplicate delivery ignored");
  }

  try {
    const event = req.get("x-github-event");
    const payload = req.body;

    if (event === "release") {
      const announcement = releaseAnnouncement(payload, GITHUB_WEBHOOK_REPOSITORY);
      if (announcement && !announcedReleaseIds.has(announcement.id)) {
        announcedReleaseIds.add(announcement.id);
        try {
          await sendReleaseAnnouncement(announcement.messages);
        } catch (error) {
          announcedReleaseIds.delete(announcement.id);
          throw error;
        }
      }
    }

    if (
      event === "issue_comment" &&
      payload?.action === "created" &&
      isTranslationReviewIssue(payload) &&
      payload.comment?.user?.login === "github-actions[bot]" &&
      typeof payload.comment?.body === "string" &&
      TRANSLATION_BATCH_MARKER.test(payload.comment.body) &&
      typeof payload.issue?.html_url === "string"
    ) {
      await sendTranslationReviewNotification(payload.issue.html_url);
    }

    if (event === "issues" && payload?.action === "closed") {
      const body = payload.issue?.body || "";
      const match = body.match(
        /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/
      );

      if (match && typeof payload.issue?.html_url === "string") {
        const [, , channelId, messageId] = match;
        const channel = await client.channels.fetch(channelId);
        if (channel?.isTextBased()) {
          const message = await channel.messages.fetch(messageId);
          await message.reply(`GitHub issue closed: ${payload.issue.html_url}`);
        }
      }
    }

    if (deliveryId) deliveryCache.set(deliveryId, Date.now());
    return res.status(200).send("ok");
  } catch (error) {
    console.error(`GitHub webhook delivery ${deliveryId || "(unknown)"} failed:`, error);
    return res.status(500).send("webhook handling failed");
  }
});
