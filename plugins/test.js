import nexus from "../lib/plugin.js";

nexus(
  {
    on: "text",
    Category: "fun",
    Info: "Repeats whatever you say after the keyword 'say'",
    React: "🗣️",
    Listen: "say"
  },
  async (m) => {
    const text = m.text.trim();
    const [, ...args] = text.split(/\s+/);
    if (!args.length) return m.reply("You didn’t tell me what to say 😅");
    await m.reply(args.join(" "));
  }
);

nexus(
  {
    name: "ping",
    alias: "p",
    Category: "utility",
    Info: "Replies with pong",
    React: "🔥"
  },
  async (m) => {
    await m.reply("pong!");
  }
);

nexus(
  {
    name: "sticker",
    alias: "s",
    Category: "media",
    Info: "Converts an image to a sticker",
    React: "🎨"
  },
  async (m) => {
    if (m.type !== "imageMessage") {
      return m.reply("Please reply to an image to make a sticker.");
    }
    const buffer = await m.client.downloadMediaMessage(m);
    await m.sendSticker(buffer);
  }
);

nexus(
  {
    on: "imageMessage",
    Category: "media",
    Info: "Replies whenever an image is sent",
    React: "🖼️"
  },
  async (m) => {
    await m.reply("Nice picture! 📸");
  }
);