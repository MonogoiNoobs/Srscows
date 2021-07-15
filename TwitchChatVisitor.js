export class TwitchChatVisitor extends WebSocket {
  #privmsgRegExp = /:(\w+)!\w+@\w+\.tmi\.twitch\.tv\sPRIVMSG\s#\w+\s:(.+)/u
  static #glhfRegExp = /^:tmi\.twitch\.tv\s\d{3}\sjustinfan\d{1,4}\s:Welcome,\sGLHF!$/u;
  static #singleton = null;
  #channel = null;

  constructor() {
    super("wss://irc-ws.chat.twitch.tv:443");

    this.addEventListener("open", _ => {
      this.send(`NICK justinfan${Math.trunc(10000 * Math.random())}`);
    }, { once: true });
  }

  join(channel) {
    if (this.#channel) {
      this.part();
    };
    if (!this.isValidChannelName(channel)) throw new Error("invalid channel as fuck");
    this.#channel = channel;
    this.send(`JOIN #${this.#channel}`);
    this.addEventListener("message", this.messageCallback, false);
  }

  part() {
    if (!this.#channel) throw new Error("not joined as fuck for the fucj");
    this.send(`PART #${this.#channel}`);
    this.#channel = null;
    this.removeEventListener("message", this.messageCallback, false);
  }

  messageCallback(event) {
    const data = event.data.trim();

    if (data === "PING :tmi.twitch.tv") {
      this.send("PONG :tmi.twitch.tv");
      return;
    }
    const filtered = this.#privmsgRegExp.exec(data);
    if (filtered) {
      this.dispatchEvent(new MessageEvent("chat", {
        data: {
          name: filtered[1],
          chat: filtered[2],
        }
      }))
    }
  }

  isValidChannelName(channel) {
    return channel != null && /^\w+$/.test(channel);
  }

  static connect() {
    if (TwitchChatVisitor.#singleton) {
      return new Promise(resolve => resolve(TwitchChatVisitor.#singleton));
    }
    return new Promise((resolve, reject) => {
      const glhfEvent = event => {
        if (TwitchChatVisitor.#glhfRegExp.test(event.data.split("\n")[0].trim())) {
          event.target.removeEventListener("message", glhfEvent, false);
          resolve(event.target);
        }
      }
      try {
        TwitchChatVisitor.#singleton = new TwitchChatVisitor();
        TwitchChatVisitor.#singleton.addEventListener("message", glhfEvent, false);
      } catch (e) {
        reject(e);
      }
    })
  }
}
