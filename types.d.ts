import {
  APIApplicationCommandOption,
  ChatInputCommandInteraction,
  PermissionResolvable,
} from "discord.js";

type Command = {
  description: string;
  options?: APIApplicationCommandOption[]; // optional slash options
  requiredPermissions?: PermissionResolvable; // optional gate
  fn: (interaction: ChatInputCommandInteraction) => Promise<void>;
};
