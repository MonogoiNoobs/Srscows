/**
 * @license 0BSD
 */

"use strict";

let obs = null;

let recog;

let timeoutId = null;
let translatedTimeoutId = null;

let yukarinette = null;

let isRunning = false;
let hasRequestedEnd = false;

class TwitchChatVisitor extends WebSocket {
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
    console.log("joined as fuck:", channel)
  }

  part() {
    if (!this.#channel) throw new Error("not joined as fuck for the fucj");
    this.send(`PART #${this.#channel}`);
    this.#channel = null;
    this.removeEventListener("message", this.messageCallback, false);
    console.log("parted as fuck")
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
          console.log("resolved")
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

const japaneseSpacesRegExp = /(?<=[^!-~])\s(?=[^!-~])/gu;
const strangeSpacesRegExp = /(?:(?<=[!-~])\s(?=[^!-~])|(?<=[^!-~])\s(?=[!-~]))/gu;

const output = document.querySelector("#stdout");
const translatedOutput = document.querySelector("#trans");
const form = document.forms.main.elements;

const hashPromise = arg => crypto.subtle.digest("SHA-256", new TextEncoder().encode(arg));

const buftoa = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

const toggleAll = () => {
  form.submit.toggleAttribute("disabled");
  form.cancel.toggleAttribute("disabled");
  form.field.toggleAttribute("disabled");
  if (yukarinette) {
    form.yukarinettePort.removeAttribute("disabled");
    form.yukarinettePort.setAttribute("disabled", "disabled");
  }
};

const makeRecognition = () => {
  recog = Object.assign(new webkitSpeechRecognition() || new SpeechRecognition(), {
    lang: globalThis.navigator.language,
    interimResults: true,
    continuous: true,
  });

  let isFinal = false;

  recog.onerror = event => {
    event.currentTarget.start();
  }

  recog.onend = event => {
    if (!hasRequestedEnd) event.currentTarget.start();
  }

  recog.onresult = async event => {
    const currentResult = event.results[event.results.length - 1];
    const latestTranscript = currentResult[0].transcript;
    isFinal = currentResult.isFinal;

    const prepareTrimming = form.doesTrim.checked ? latestTranscript.replace(japaneseSpacesRegExp, "") : latestTranscript;
    const trimmed = form.doesTrimStrangers.checked ? prepareTrimming.replace(strangeSpacesRegExp, "") : prepareTrimming;

    if (timeoutId) globalThis.clearTimeout(timeoutId);
    if (translatedTimeoutId) globalThis.clearTimeout(translatedTimeoutId);

    if (isFinal) {
      output.textContent = trimmed;
      obs.send(JSON.stringify({
        "request-type": `SetText${form.type.value}Properties`,
        "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
        "source": form.src.value,
        "text": trimmed,
      }));

      const prepareBouyomiChanTrimming = form.bouyomiChanDoesTrim.checked
        ? latestTranscript.replace(japaneseSpacesRegExp, "")
        : latestTranscript;
      const trimmedBouyomiChan = form.bouyomiChanDoesTrimStrangers.checked
        ? prepareTrimming.replace(strangeSpacesRegExp, "")
        : prepareBouyomiChanTrimming;


      if (form.hasBouyomiChan.checked && !form.bouyomiChanHasTwitch.checked)
        fetch(`http://localhost:${form.bouyomiChanPort.value}/talk?text=${trimmedBouyomiChan}`, { mode: "no-cors" })
          .catch(_ => {
            document.querySelector("#bcout").textContent = "棒読みちゃんとの接続に失敗しました。";
          });

      const prepareYukarinetteTrimming = form.yukarinetteDoesTrim.checked ? latestTranscript.replace(japaneseSpacesRegExp, "") : latestTranscript;
      const trimmedYukarinette = form.yukarinetteDoesTrimStrangers.checked ? prepareTrimming.replace(strangeSpacesRegExp, "") : prepareYukarinetteTrimming;

      if (form.hasYukarinette.checked && !!yukarinette) {
        yukarinette.send(`0:${trimmedYukarinette}`);
        document.querySelector("#ykout").textContent = `ゆかりねっとに送信: [0:${trimmedYukarinette}]`;
      }

      if (form.isTranslation.checked) {
        const res = await fetch(`https://script.google.com/macros/s/${form.gas.value}/exec?text=${latestTranscript}&source=ja&target=en`, {
          mode: "cors",
        }).catch(_ => {
          translatedOutput.textContent = "翻訳エラー: デプロイ ID が不正です。";
        });
        const translatedTranscript = await res.text();

        translatedOutput.textContent = translatedTranscript;
        obs.send(JSON.stringify({
          "request-type": `SetText${form.type.value}Properties`,
          "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
          "source": form.transrc.value,
          "text": translatedTranscript,
        }));
        if (Number(form.transfadetime.value)) {
          translatedTimeoutId = globalThis.setTimeout(() => {
            translatedOutput.textContent = "";
            if (!obs) return;
            obs.send(JSON.stringify({
              "request-type": `SetText${form.type.value}Properties`,
              "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
              "source": form.transrc.value,
              "text": "",
            }));
          }, Number(form.transfadetime.value));
        }


      }

      if (Number(form.fadetime.value)) {
        timeoutId = globalThis.setTimeout(() => {
          output.textContent = "";
          if (!obs) return;
          obs.send(JSON.stringify({
            "request-type": `SetText${form.type.value}Properties`,
            "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
            "source": form.src.value,
            "text": "",
          }));
        }, Number(form.fadetime.value));
      }
    } else {
      const remaining = form.isBracketed.checked ? `<< ${latestTranscript} >>` : latestTranscript;
      output.textContent = remaining;
      obs.send(JSON.stringify({
        "request-type": `SetText${form.type.value}Properties`,
        "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
        "source": form.src.value,
        "text": remaining,
      }));
    }

  };

  hasRequestedEnd = false;
  recog.start();
};

const afterConnected = () => {
  isRunning = true;
  output.textContent = "*READY*";
  translatedOutput.textContent = "";

  makeRecognition();
}

const isValid = elements => {
  if (form.isTranslation.checked && !/^[A-Za-z\d_]+$/u.test(elements.gas.value)) {
    translatedOutput.textContent = "翻訳エラー: 無効なデプロイ ID です。";
    return false;
  }
  return true;
};

const submit = event => {
  event.preventDefault();
  toggleAll();

  if (!isValid(document.forms.main.elements)) {
    toggleAll();
    return;
  }

  if (form.bouyomiChanHasTwitch.checked) {

    TwitchChatVisitor.connect()
      .then(twitch => {
        const chat = event => {
          const built = `${event.data.name}${form.bouyomiChanTwitchHonorific.value}、${event.data.chat}`;
          document.querySelector("#bcout").textContent = `棒読みちゃんへ送信: [${built}]`
          fetch(`http://localhost:${form.bouyomiChanTwitchPort.value}/talk?text=${built}`, { mode: "no-cors" })
            .catch(_ => {
              document.querySelector("#bcout").textContent = "棒読みちゃんとの接続に失敗しました。";
            });
        };
        twitch.join(form.bouyomiChanTwitchId.value);
        twitch.addEventListener("chat", chat, false);

        const fuckoff = event => {
          twitch.part();
          twitch.removeEventListener("chat", chat, false);
          console.log("Twitch disconnected as fuck")
        };

        document.addEventListener("twitchyousuck", fuckoff, { once: true });
      }).catch(e => {
        document.querySelector("#bcout").textContent = `Twitch との接続に失敗しました: ${e}`;
      });

  }

  if (form.hasYukarinette.checked && !yukarinette) {
    yukarinette = Object.assign(new WebSocket(`ws://localhost:${Number(form.yukarinettePort.value)}`), {
      onopen() {
        document.querySelector("#ykout").textContent = "ゆかりねっとに接続しました。";
      },
      onerror() {
        document.querySelector("#ykout").textContent = "ゆかりねっととの接続に失敗しました。";
        yukarinette = null;
        if (!isRunning) {
          form.yukarinettePort.removeAttribute("disabled");
        }
      },
    });
  }

  obs = new WebSocket(`ws://localhost:${form.port.value}`);

  obs.onopen = () => {
    obs.send(JSON.stringify({
      "request-type": "GetAuthRequired",
      "message-id": "srscows-getauthrequired",
    }));
  };

  obs.onmessage = event => {
    const message = JSON.parse(event.data);

    if (message.hasOwnProperty("error")) {
      obs.dispatchEvent(new ErrorEvent("error", { message: message.error }));
      return;
    }

    switch (message["message-id"]) {
      case "srscows-getauthrequired": {
        if (message.authRequired) {
          hashPromise(`${form.pass.value}${message.salt}`).then(passsalt => {
            hashPromise(`${buftoa(passsalt)}${message.challenge}`).then(auth => {
              obs.send(JSON.stringify({
                "request-type": "Authenticate",
                "message-id": "srscows-authenticate",
                auth: buftoa(auth),
              }));
            })
          })
        } else {
          afterConnected();
        }
      } break;

      case "srscows-authenticate": {
        afterConnected();
      } break;

      default: break;
    }
  };



  obs.onerror = event => {
    isRunning = false;
    toggleAll();
    output.textContent = `[ERROR] ${event.message ?? "OBS が起動していないか、ポート番号が間違っています。"}`;
    cleanup();
  };
};


const cleanup = () => {
  isRunning = false;
  hasRequestedEnd = true;
  if (timeoutId) globalThis.clearTimeout(timeoutId);
  if (translatedTimeoutId) globalThis.clearTimeout(translatedTimeoutId);
  if (obs) {
    obs.send(JSON.stringify({
      "request-type": `SetText${form.type.value}Properties`,
      "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
      "source": form.src.value,
      "text": "",
    }));
    output.textContent = "";
    translatedOutput.textContent = "";
    if (form.isTranslation.checked) {
      obs.send(JSON.stringify({
        "request-type": `SetText${form.type.value}Properties`,
        "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
        "source": form.transrc.value,
        "text": "",
      }));
    }
    obs.close();
    obs = null;
  }
  document.querySelector("#bcout").textContent = "";
  if (recog) recog.stop();
  document.dispatchEvent(new CustomEvent("twitchyousuck"));
};

form.submit.addEventListener("click", submit, false);

form.cancel.addEventListener("click", event => {
  event.preventDefault();
  cleanup();
  toggleAll();
}, false);

window.addEventListener("unload", _ => {
  console.log("cleanup");
  cleanup();
  form.field.setAttlibute("disabled");
  if (yukarinette) yukarinette.close();
}, false);
