import chalk from "chalk";

export function logMessage(s, fromName) {
  let contentLog = "";
  const caption = s.text?.trim() ? `: ${s.text}` : "";

  if (s.isStatus) {
    switch (s.type) {
      case "status":
      case "conversation":
      case "extendedTextMessage":
        contentLog = chalk.white(`Text${caption}`);
        break;
      case "imageMessage":
        contentLog = chalk.blue(`Image${caption}`);
        break;
      case "videoMessage":
        contentLog = chalk.magenta(`Video${caption}`);
        break;
      case "audioMessage":
        contentLog = chalk.cyan(`Audio${caption}`);
        break;
      case "stickerMessage":
        contentLog = chalk.green(`Sticker${caption}`);
        break;
      case "documentMessage":
      case "documentWithCaptionMessage":
        contentLog = chalk.yellow(`Document${caption}`);
        break;
    }
  } else {
    switch (s.type) {
      case "conversation":
      case "extendedTextMessage":
        if (s.text?.trim()) contentLog = chalk.white(`Text: ${s.text}`);
        break;
      case "imageMessage":
        contentLog = chalk.blue(`Image${s.text ? " | " + s.text : ""}`);
        break;
      case "videoMessage":
        contentLog = chalk.magenta(`Video${s.text ? " | " + s.text : ""}`);
        break;
      case "audioMessage":
        contentLog = chalk.cyan(`Audio`);
        break;
      case "stickerMessage":
        contentLog = chalk.green(`Sticker`);
        break;
      case "documentMessage":
      case "documentWithCaptionMessage":
        contentLog = chalk.yellow(`Document${s.text ? " | " + s.text : ""}`);
        break;
      case "reactionMessage":
        if (s.reaction?.text) contentLog = chalk.red(`Reaction: ${s.reaction.text}`);
        break;
      case "pollCreationMessageV3":
        contentLog = chalk.greenBright(
          `Poll: ${s.poll?.name} [${s.poll?.options?.join(", ")}]`
        );
        break;
      case "pollUpdateMessage":
        contentLog = chalk.greenBright(`Poll Update`);
        break;
    }
  }

  if (contentLog) {
    console.log(chalk.bold(fromName) + " " + contentLog);
    if (s.quoted?.text) {
      console.log(chalk.dim(`   ↳ quoted: ${s.quoted.text}`));
    }
  }
}