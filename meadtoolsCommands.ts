import type { ChatInputCommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { Command, safeReply } from "./slashCommands";

const BASE_URL = "https://meadtools.com";

const TOOLS = [
  { label: "Calculator (home)", path: "/" },
  { label: "Nutrient Calculator", path: "/nute-calc" },
  { label: "ABV", path: "/extra-calcs" },
  { label: "Brix", path: "/extra-calcs/brix" },
  { label: "Estimated OG", path: "/extra-calcs/estimated-og" },
  { label: "Bench Trials", path: "/extra-calcs/bench-trials" },
  { label: "Sulfite", path: "/extra-calcs/sulfite" },
  { label: "Sorbate", path: "/extra-calcs/sorbate" },
  {
    label: "Refractometer Correction",
    path: "/extra-calcs/refractometer-correction",
  },
  {
    label: "Temperature Correction",
    path: "/extra-calcs/temperature-correction",
  },
  { label: "Blending", path: "/extra-calcs/blending" },
  { label: "Priming Sugar", path: "/extra-calcs/priming-sugar" },
  { label: "Stabilizers", path: "/stabilizers" },
  { label: "Juice Calc", path: "/juice" },
  { label: "Yeast Table", path: "/yeasts" },
  { label: "Tutorial", path: "/tutorial" },
];

// Discord choices (<=25). Value = full URL so the handler is trivial.
const CHOICES = TOOLS.map((t) => ({
  name: t.label,
  value: `${BASE_URL}${t.path}`,
}));

export const meadtoolsCommands: Record<string, Command> = {
  meadtools: {
    description: "Get a direct link to a MeadTools page.",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "tool",
        description: "Pick a tool/page",
        required: false,
        choices: CHOICES,
      },
    ] as const,
    fn: async (int: ChatInputCommandInteraction) => {
      const url = int.options.getString("tool"); // this is already the full URL
      if (url) {
        await safeReply(int, url);
        return;
      }

      const base =
        `[Calculator](${BASE_URL}/)\n` +
        `[Video walkthrough](https://youtube.com/playlist?list=PLK2MubdaaOrUaQnjvfsJnqJv3agRmd4oS&si=ZV0NCqxCioRmg9mq)\n\n` +
        `Tip: use \`/meadtools tool:\` to jump straight to a page.`;

      await safeReply(int, base);
    },
  },
};
