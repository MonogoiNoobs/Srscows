import { IRCParser } from "./IRCParser.js";

export class TwitchChat extends WebSocket {
  #parser = new IRCParser();

  constructor({
    password,
    nickname,
    channels,
  } = {
      password: "",
      nickname: `justinfan${Math.trunc(10000 * Math.random())}`,
      channels: [],
    }) {
    super("wss://irc-ws.chat.twitch.tv:443");

    super.addEventListener("open", _ => {
      this.pass(password);
      this.nick(nickname);
      this.join(channels);
    }, { once: true });

    super.addEventListener("message", event => {
      const data = this.#parser.parse(event.data);

      if (data.verb === IRCParser.Verbs.PING)
        return this.pong();

      this.dispatchEvent(new MessageEvent("chat", {
        data
      }));
    });
  }

  join(channels) {
    super.send(this.#parser.stringify({
      verb: IRCParser.Verbs.JOIN,
      hasTrailing: false,
      params: channels
        .map(channelName => channelName.toLowerCase())
        .join(","),
    }));
  }

  part(...channels) {
    super.send(this.#parser.stringify({
      verb: IRCParser.Verbs.PART,
      hasTrailing: false,
      params: channels
        .map(channelName => channelName.toLowerCase())
        .join(","),
    }));
  }

  nick(nick) {
    super.send(this.#parser.stringify({
      verb: IRCParser.Verbs.NICK,
      params: [nick],
      hasTrailing: false
    }));
  }

  pass(pass) {
    if (pass === "") return;
    super.send(this.#parser.stringify({
      verb: IRCParser.Verbs.PASS,
      params: [pass],
      hasTrailing: false
    }));
  }

  privmsg(msg) {
    if (!msg) return;
    super.send(this.#parser.stringify({
      verb: IRCParser.Verbs.PRIVMSG,
      params: [msg],
      hasTrailing: true
    }));
  }

  pong() {
    super.send(this.#parser.stringify({
      verb: IRCParser.Verbs.PONG,
      params: ["tmi.twitch.tv"],
      hasTrailing: true
    }));
  }

  static connect(obj) {
    return new Promise((resolve, reject) => {
      const glhfEvent = event => {
        const cb = e => {
          if (this.#parser.parse(e.data).verb === IRCParser.Numerics.RPL.WELCOME) {
            e.currentTarget.removeListener("message", cb);
            e.currentTarget.removeListener("open", glhfEvent);
            resolve(e.currentTarget);
          }
        }
        event.currentTarget.addEventListener("message", cb)
      }
      try {
        new this(obj).addEventListener("open", glhfEvent);
      } catch (e) {
        reject(e);
      }
    })
  }
}
