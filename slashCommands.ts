import type {
  ChatInputCommandInteraction,
  PermissionResolvable,
} from "discord.js";
import {
  ApplicationCommandOptionType,
  type APIApplicationCommandOption,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { getAbv, toBrix } from "./utils";
import { meadtoolsCommands } from "./meadtoolsCommands";

export type Command = {
  description: string;
  options?: APIApplicationCommandOption[]; // optional slash options
  requiredPermissions?: PermissionResolvable; // optional gate
  fn: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export const commandMap: Record<string, Command> = {
  abv: {
    description:
      "Calculates the abv based on an original and final gravity reading.",
    options: [
      {
        type: ApplicationCommandOptionType.Number,
        name: "og",
        description: "The original gravity of your brew.",
        required: true,
        min_value: 0.98,
        max_value: 1.2,
      },
      {
        type: ApplicationCommandOptionType.Number,
        name: "fg",
        description: "The final gravity of your brew.",
        min_value: 0.98,
        max_value: 1.2,
      },
    ],
    fn: async (int) => {
      const og = int.options.getNumber("og", true);
      const fg = int.options.getNumber("fg") ?? 0.996;

      const invalid =
        Number.isNaN(og) ||
        Number.isNaN(fg) ||
        og < fg || // OG should be >= FG
        og > 1.22 ||
        fg > 1.22 ||
        og - fg > 0.165; // ~23% ABV cap

      if (invalid) {
        await safeReply(
          int,
          "Please enter valid gravity values. Example: `/abv og: 1.050 fg: 1.010`"
        );
        return;
      }

      const [delle, ABV] = getAbv(og, fg);

      await safeReply(
        int,
        `An OG of ${og.toFixed(3)} and an FG of ${fg.toFixed(
          3
        )} yields **${ABV}% ABV** and **${delle} delle units**.`
      );
    },
  },
  delle: {
    description: "Calculates delle units from ABV (%) and final gravity (SG).",
    options: [
      {
        type: ApplicationCommandOptionType.Number,
        name: "abv",
        description: "Alcohol by volume percentage (e.g., 12.5).",
        required: true,
        min_value: 0,
        max_value: 23,
      },
      {
        type: ApplicationCommandOptionType.Number,
        name: "fg",
        description: "Final gravity in specific gravity (e.g., 0.996).",
        required: true,
        min_value: 0.98,
        max_value: 1.2,
      },
    ],
    fn: async (int) => {
      const abv = int.options.getNumber("abv", true);
      const fg = int.options.getNumber("fg", true);

      // Extra guards (defensive)
      if (
        isNaN(abv) ||
        isNaN(fg) ||
        abv < 0 ||
        abv > 23 ||
        fg < 0.98 ||
        fg > 1.2
      ) {
        await safeReply(
          int,
          "Please provide ABV between 0–23 and FG between 0.980–1.200."
        );
        return;
      }

      // Ensure `toBrix` expects SG → Brix
      const delle = Math.round(toBrix(fg) + 4.5 * abv);
      const isStable = delle >= 73;

      const response =
        `**${abv.toFixed(2)}%** ABV and FG **${fg.toFixed(3)}** ` +
        `→ **${delle} delle units**.\n` +
        (isStable
          ? "Your brew is likely stable without chemical stabilizers."
          : "Your brew will likely need stabilizers to prevent refermentation.");

      await safeReply(int, response);
    },
  },
  ...meadtoolsCommands,
} as const;

// JSON to register (guild/global)
export const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
  Object.entries(commandMap).map(([name, { description, options }]) => ({
    name,
    description,
    options,
    // dm_permission: false, // uncomment if you want to disable in DMs
  }));

// Small helper to avoid "Unknown interaction" errors if you've already replied/deferred
export async function safeReply(
  interaction: ChatInputCommandInteraction,
  content: string
) {
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({ content });
  }
  return interaction.reply({ content });
}
