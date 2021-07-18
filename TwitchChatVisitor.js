import { IRCParser } from "./IRCParser.js";

export class TwitchChatVisitor extends WebSocket {
  #channel = null;
  #parser = new IRCParser({ doesRequireStrictHost: false, doesTryConvertKebabTagKeysToCamel: true });
  static singleton = null;

  constructor() {
    super("wss://irc-ws.chat.twitch.tv:443");
  }

  join(channel) {
    if (this.#channel) {
      this.part();
    }
    this.#channel = channel
      .filter(v => this.isValidChannelName(v))
      .map(v => `#${v}`)
      .join(",");
    this.send(this.#parser.stringify({
      verb: IRCParser.Verbs.JOIN,
      params: [this.#channel]
    }));
    this.addEventListener("message", this.messageCallback, false);
  }

  part() {
    if (!this.#channel) throw new Error("not joined as fuck for the fucj");
    this.send(this.#parser.stringify({
      verb: IRCParser.Verbs.PART,
      params: [this.#channel]
    }));
    this.#channel = null;
    this.removeEventListener("message", this.messageCallback, false);
  }

  messageCallback(event) {
    const data = this.#parser.parse(event.data);
    switch (data.verb) {
      case IRCParser.Verbs.PRIVMSG:
        this.dispatchEvent(new MessageEvent("chat", {
          data: {
            name: data.tags.displayName,
            chat: data.params.pop(),
          }
        }))
        break;

      case IRCParser.Verbs.PING:
        event.currentTarget.send(parser.stringify({
          verb: IRCParser.Verbs.PONG,
          params: data.params
        }).trimEnd());
        break;
    }
  }

  isValidChannelName(channel) {
    return channel != null && /^\w+$/.test(channel);
  }

  static connect() {
    return new Promise((resolve) => {
      if (TwitchChatVisitor.singleton) resolve(TwitchChatVisitor.singleton);
      const parser = new IRCParser({ doesRequireStrictHost: false, doesTryConvertKebabTagKeysToCamel: true });
      const twitch = new TwitchChatVisitor();
      const resolver = event => {
        if (parser.parse(event.data).verb === IRCParser.Numerics.RPL.WELCOME) {
          event.currentTarget.removeEventListener("message", resolver);
          TwitchChatVisitor.singleton = event.currentTarget;
          resolve(event.currentTarget);
        }
      }
      twitch.addEventListener("open", event => {
        event.currentTarget.send(parser.stringify({
          verb: IRCParser.Verbs.CAP,
          params: ["REQ", "twitch.tv/tags"]
        }));
        event.currentTarget.send(parser.stringify({
          verb: IRCParser.Verbs.NICK,
          params: [`justinfan${Math.trunc(Math.random() * 10000)}`]
        }));
      }, { once: true });
      twitch.addEventListener("message", resolver);
    })
  }
}
