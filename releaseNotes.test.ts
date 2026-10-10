import { describe, expect, test } from "bun:test";
import { releaseAnnouncement, splitDiscordMessage } from "./releaseNotes";

const publishedRelease = {
  action: "published",
  repository: { full_name: "ljreaux/MeadTools" },
  release: {
    id: 123,
    name: "October 2026 initial release",
    body: "# October 2026 initial release\n\n## Web\n\n- A new feature.",
    html_url: "https://github.com/ljreaux/MeadTools/releases/tag/release-2026-10-05",
    tag_name: "release-2026-10-05",
    draft: false,
    prerelease: false,
  },
};

describe("release announcement", () => {
  test("mirrors a published MeadTools release and links to it", () => {
    expect(releaseAnnouncement(publishedRelease, "ljreaux/MeadTools")).toEqual({
      id: 123,
      messages: [
        "# October 2026 initial release\n\n## Web\n\n- A new feature.\n\nhttps://github.com/ljreaux/MeadTools/releases/tag/release-2026-10-05",
      ],
    });
  });

  test("ignores draft, prerelease, unrelated and non-release events", () => {
    expect(releaseAnnouncement({ ...publishedRelease, action: "edited" }, "ljreaux/MeadTools")).toBeNull();
    expect(releaseAnnouncement(publishedRelease, "someone/else")).toBeNull();
    expect(releaseAnnouncement({ ...publishedRelease, release: { ...publishedRelease.release, draft: true } }, "ljreaux/MeadTools")).toBeNull();
    expect(releaseAnnouncement({ ...publishedRelease, release: { ...publishedRelease.release, prerelease: true } }, "ljreaux/MeadTools")).toBeNull();
    expect(releaseAnnouncement({ ...publishedRelease, release: { ...publishedRelease.release, tag_name: "hotfix" } }, "ljreaux/MeadTools")).toBeNull();
  });

  test("splits long notes into Discord-sized messages", () => {
    const messages = splitDiscordMessage(`## Web\n\n${"An improvement. ".repeat(300)}`);
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 1900)).toBe(true);
    expect(messages.join(" ").replace(/\s+/g, " ")).toBe(
      `## Web ${"An improvement. ".repeat(300)}`.trim().replace(/\s+/g, " ")
    );
  });
});
