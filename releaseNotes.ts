const RELEASE_TAG = /^release-\d{4}-\d{2}-\d{2}$/;
const DISCORD_MESSAGE_LIMIT = 1900;

type ReleasePayload = {
  action?: string;
  repository?: { full_name?: string };
  release?: {
    id?: number;
    name?: string;
    body?: string;
    html_url?: string;
    tag_name?: string;
    draft?: boolean;
    prerelease?: boolean;
  };
};

export function releaseAnnouncement(
  payload: ReleasePayload,
  repository: string
): { id: number; messages: string[] } | null {
  const release = payload.release;
  if (
    payload.action !== "published" ||
    payload.repository?.full_name !== repository ||
    !release ||
    typeof release.id !== "number" ||
    !RELEASE_TAG.test(release.tag_name || "") ||
    release.draft ||
    release.prerelease ||
    typeof release.html_url !== "string"
  ) {
    return null;
  }

  const notes = release.body?.trim() || release.name?.trim() || release.tag_name;
  const text = `${notes}\n\n${release.html_url}`;
  return { id: release.id, messages: splitDiscordMessage(text) };
}

export function splitDiscordMessage(text: string): string[] {
  const messages: string[] = [];
  let remaining = text.trim();

  while (remaining.length > DISCORD_MESSAGE_LIMIT) {
    const candidate = remaining.slice(0, DISCORD_MESSAGE_LIMIT);
    const newline = candidate.lastIndexOf("\n");
    const space = candidate.lastIndexOf(" ");
    const splitAt =
      newline > DISCORD_MESSAGE_LIMIT / 2
        ? newline + 1
        : space > DISCORD_MESSAGE_LIMIT / 2
        ? space + 1
        : DISCORD_MESSAGE_LIMIT;

    messages.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) messages.push(remaining);
  return messages;
}
