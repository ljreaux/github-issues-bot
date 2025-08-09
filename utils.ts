import {
  ActionRowBuilder,
  ModalBuilder,
  REST,
  Routes,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { commands } from "./slashCommands";

const { BOT_TOKEN = "", APPLICATION_ID = "" } = process.env;

const modalTypes = [
  {
    type: "feature",
    title: "Create feature request",
    issueTitle: "Feature Request Title",
    issueDescription: "Feature Request Description",
  },
  {
    type: "bug",
    title: "Create bug Report",
    issueTitle: "Bug Report Title",
    issueDescription: "Bug Report Description",
  },
];

export const getModal = (type: string, description: string, repo: string) => {
  const modalType = modalTypes.find((t) => t.type === type);

  const modal = new ModalBuilder()
    .setTitle(modalType?.title ?? "Create Issue")
    .setCustomId(`${type}Modal:${repo}`); // include repo in customId

  const issueTitle = new TextInputBuilder()
    .setStyle(TextInputStyle.Short)
    .setCustomId("issueTitle")
    .setLabel(modalType?.issueTitle ?? "Issue Title");

  const issueDescription = new TextInputBuilder()
    .setStyle(TextInputStyle.Paragraph)
    .setCustomId("issueDescription")
    .setLabel(modalType?.issueDescription ?? "Issue Description")
    .setValue(description);

  const rows = [issueTitle, issueDescription].map((component) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents([component])
  );

  modal.addComponents(rows);

  return modal;
};

export const reloadCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(APPLICATION_ID), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
};
export const toBrix = (value: number) =>
  -668.962 + 1262.45 * value - 776.43 * value ** 2 + 182.94 * value ** 3;

export const getAbv = (OG: number, FG: number) => {
  const OE = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  const AE = -668.962 + 1262.45 * FG - 776.43 * FG ** 2 + 182.94 * FG ** 3;
  const q = 0.22 + 0.001 * OE;
  const RE = (q * OE + AE) / (1 + q);
  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE);
  const ABV = Math.round(ABW * (FG / 0.794) * 100) / 100;

  const delle = Math.round(toBrix(FG) + 4.5 * ABV);
  return [delle, ABV];
};
