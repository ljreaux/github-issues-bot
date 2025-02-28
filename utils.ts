import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

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

export const getModal = (type: string, description: string) => {
  const modalType = modalTypes.find((t) => t.type === type);

  const modal = new ModalBuilder()
    .setTitle(modalType?.title ?? "Create Issue")
    .setCustomId(modalType?.type === "feature" ? "featureModal" : "bugModal");

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

  // Add action rows to form
  modal.addComponents(rows);

  return modal;
};
