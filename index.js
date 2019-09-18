const Plugin = require("release-it").Plugin;
const Promise = require("es6-promise").Promise;
const { IncomingWebhook } = require("@slack/webhook");
const slackifyMarkdown = require("slackify-markdown");
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const utils = require("./utils");

const TIMEOUT = 5000;
const SUCCESS_TEXT = "New version has been released";
const HOOK_TOKEN_REF = "SLACK_WEBHOOK_URL";

const defaultOptions = {
  webHookUrl: null,
  convertMarkdown: false,
  hookTokenRef: HOOK_TOKEN_REF,
  successMessage: SUCCESS_TEXT,
  errorMessage: null
};

class SlackNotify extends Plugin {
  constructor(...args) {
    super(...args);
  }

  init() {
    this.options = _.extend({}, defaultOptions, this.options);
  }

  bump(version) {
    this.version = version;
  }

  getWebhookUrl() {
    let url;
    if (typeof this.options.webHookUrl === "string") {
      url = this.options.webHookUrl;
    } else {
      url = process.env[this.options.hookTokenRef || HOOK_TOKEN_REF];
    }

    return url;
  }

  getJSONPayload(message) {
    const replaced = utils.replaceInString(JSON.stringify(message), {
      version: this.version
    });
    return JSON.parse(replaced);
  }

  isMessageFilePath(message) {
    return utils.isFileAccessible(path.resolve(message));
  }

  getFileContentPayload(file) {
    const data = fs.readFileSync(file);
    const trimmed = data.toString().trim();
    const text = this.options.convertMarkdown
      ? slackifyMarkdown(trimmed)
      : trimmed;

    return {
      type: "mrkdwn",
      text: utils.replaceInString(text, { version: this.version })
    };
  }

  getFilePayload(message) {
    const file = path.resolve(message);
    try {
      const func = require(file);
      if (typeof func === "function") {
        return func.call(null, this.version);
      }
      return func.toString();
    } catch (error) {
      return this.getFileContentPayload(file);
    }
  }

  getTextPayload(message) {
    const text = this.options.convertMarkdown
      ? slackifyMarkdown(message)
      : message;

    return {
      type: "mrkdwn",
      text: utils.replaceInString(text, { version: this.version })
    };
  }

  getValidSlackMessage(message) {
    if (typeof message === "string" || typeof message === "object") {
      if (typeof message === "object") {
        return this.getJSONPayload(message);
      } else if (this.isMessageFilePath(message)) {
        return this.getFilePayload(message);
      }
      return this.getTextPayload(message);
    }

    return false;
  }

  sendNotification(payload) {
    const webHookUrl = this.getWebhookUrl();

    return new Promise((resolve, reject) => {
      if (!payload) {
        reject(new Error("Provide a valid slack message payload"));
      }
      const timeout = setTimeout(() => {
        reject(new Error("Slack request timed out"));
      }, TIMEOUT);

      const webhook = new IncomingWebhook(webHookUrl);
      webhook
        .send(payload)
        .then(function(result) {
          resolve(result);
        })
        .catch(function(err) {
          throw new Error(err);
          reject(err);
        });
    });
  }

  release() {
    this.isReleased = true;
  }

  async afterRelease() {
    const successPayload = this.getValidSlackMessage(
      this.options.successMessage
    );

    const errorPayload = this.getValidSlackMessage(this.options.errorMessage);

    if (this.isReleased && successPayload) {
      await this.sendNotification(successPayload);
    } else if (!this.isReleased && errorPayload) {
      await this.sendNotification(errorPayload);
    }
  }
}

module.exports = SlackNotify;
