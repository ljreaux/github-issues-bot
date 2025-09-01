import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { Command } from "../types";

// ---------------- Types & Helpers ----------------

type Yeast = {
  id: number;
  brand: string;
  name: string;
  nitrogen_requirement: string;
  tolerance: string; // e.g. "18"
  low_temp: string; // e.g. "50"
  high_temp: string; // e.g. "86"
};

const BRANDS = [
  "Lalvin",
  "Red Star",
  "Mangrove Jack",
  "Fermentis",
  "Other",
] as const;

function buildYeastEmbed(y: Yeast) {
  return new EmbedBuilder()
    .setTitle(
      `${(y.brand || "").slice(0, 100)} — ${(y.name || "").slice(0, 100)}`
    )
    .addFields(
      {
        name: "Nitrogen Requirement",
        value: (y.nitrogen_requirement || "—").slice(0, 1024),
        inline: true,
      },
      {
        name: "Alcohol Tolerance",
        value: `${y.tolerance}%`.slice(0, 1024),
        inline: true,
      },
      {
        name: "Temperature Range",
        value: `${y.low_temp}–${y.high_temp} °F`.slice(0, 1024),
        inline: true,
      }
    );
}

// Simple in-memory cache for all yeasts (to make autocomplete snappy)
const ALL_CACHE: { at: number; data: Yeast[] } = { at: 0, data: [] };
const CACHE_MS = 5 * 60_000; // 5 minutes

async function fetchAllYeasts(): Promise<Yeast[]> {
  if (Date.now() - ALL_CACHE.at < CACHE_MS && ALL_CACHE.data.length) {
    return ALL_CACHE.data;
  }

  const brands = BRANDS as readonly string[];
  const results = await Promise.all(
    brands.map(async (b) => {
      try {
        const res = await fetch(
          `https://meadtools.com/api/yeasts?brand=${encodeURIComponent(b)}`
        );
        if (!res.ok) return [] as Yeast[];
        const arr = (await res.json()) as Yeast[];
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [] as Yeast[];
      }
    })
  );
  const flat = results.flat();
  flat.sort((a, b) => a.name.localeCompare(b.name));
  ALL_CACHE.at = Date.now();
  ALL_CACHE.data = flat;
  return flat;
}

// ---------------- Command (slash run) ----------------

const yeastInfo: Command = {
  description: "Get info on a specific yeast from the MeadTools API.",
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "brand",
      description: "Yeast brand",
      required: true,
      choices: BRANDS.map((b) => ({ name: b, value: b })),
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "yeast",
      description: "Start typing a yeast name…",
      required: true,
      autocomplete: true,
    },
  ],
  fn: async (int: ChatInputCommandInteraction) => {
    const brand = int.options.getString("brand", true);
    const yeastVal = int.options.getString("yeast", true);

    if (yeastVal === "noop") {
      await int.reply({
        content: "Please choose a valid yeast from the list.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const all = await fetchAllYeasts();
      const list = all.filter((y) => y.brand === brand);
      const picked = list.find(
        (y) => String(y.id) === yeastVal || y.name === yeastVal
      );

      if (!picked) {
        await int.reply({
          content: "Yeast not found for that brand.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await int.reply({
        embeds: [buildYeastEmbed(picked)],
      });
    } catch (e: any) {
      await int
        .reply({
          content: `Error loading yeasts: ${e?.message ?? "Unknown error"}`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }
  },
};

export default yeastInfo;

// ---------------- Autocomplete handler ----------------

export async function yeastInfoAutocomplete(int: AutocompleteInteraction) {
  // Only handle this command's autocomplete
  if (int.commandName !== "yeastinfo") return;

  try {
    const brand = int.options.getString("brand") || "";
    const focused = int.options.getFocused(true); // expecting the 'yeast' option
    const q = (focused.value ?? "").toString().trim().toLowerCase();

    const all = await fetchAllYeasts();
    const inBrand = brand ? all.filter((y) => y.brand === brand) : all;

    const filtered = q
      ? inBrand.filter((y) => y.name.toLowerCase().includes(q))
      : inBrand;

    const choices = filtered.slice(0, 25).map((y) => ({
      name: y.name.slice(0, 100),
      value: String(y.id),
    }));

    if (choices.length === 0) {
      await int.respond([{ name: "No matches", value: "noop" }]);
    } else {
      await int.respond(choices);
    }
  } catch (err) {
    await int
      .respond([{ name: "Error fetching yeasts", value: "noop" }])
      .catch(() => {});
  }
}
