/**
 * @license 0BSD
 */

import { TwitchChatVisitor } from "./TwitchChatVisitor.js";
import { EasyRecognition } from "./EasyRecognition.js";
import { BouyomiChan } from "./BouyomiChan.js";

let obs = null;

const recog = new EasyRecognition();

let timeoutId = 0;
let translatedTimeoutId = 0;

let yukarinette = null;

let isRunning = false;

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

recog.addEventListener("message", async event => {
  const { transcript, isFinal } = event.data;

  const prepareTrimming = form.doesTrim.checked ? transcript.replace(japaneseSpacesRegExp, "") : transcript;
  const trimmed = form.doesTrimStrangers.checked ? prepareTrimming.replace(strangeSpacesRegExp, "") : prepareTrimming;

  clearTimeout(timeoutId);
  clearTimeout(translatedTimeoutId);

  if (isFinal) {
    output.textContent = trimmed;
    obs.send(JSON.stringify({
      "request-type": `SetText${form.type.value}Properties`,
      "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
      "source": form.src.value,
      "text": trimmed,
    }));

    const prepareBouyomiChanTrimming = form.bouyomiChanDoesTrim.checked
      ? transcript.replace(japaneseSpacesRegExp, "")
      : transcript;
    const trimmedBouyomiChan = form.bouyomiChanDoesTrimStrangers.checked
      ? prepareTrimming.replace(strangeSpacesRegExp, "")
      : prepareBouyomiChanTrimming;


    if (form.hasBouyomiChan.checked && !form.bouyomiChanHasTwitch.checked)
      fetch(`http://localhost:${form.bouyomiChanPort.value}/talk?text=${trimmedBouyomiChan}`, { mode: "no-cors" })
        .catch(_ => {
          document.querySelector("#bcout").textContent = "棒読みちゃんとの接続に失敗しました。";
        });

    const prepareYukarinetteTrimming = form.yukarinetteDoesTrim.checked
      ? transcript.replace(japaneseSpacesRegExp, "")
      : transcript;
    const trimmedYukarinette = form.yukarinetteDoesTrimStrangers.checked
      ? prepareTrimming.replace(strangeSpacesRegExp, "")
      : prepareYukarinetteTrimming;

    if (form.hasYukarinette.checked && !!yukarinette) {
      yukarinette.send(`0:${trimmedYukarinette}`);
      document.querySelector("#ykout").textContent = `ゆかりねっとに送信: [0:${trimmedYukarinette}]`;
    }

    if (Number(form.fadetime.value)) {
      timeoutId = setTimeout(() => {
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

    if (form.isTranslation.checked) {
      const res = await fetch(`https://script.google.com/macros/s/${form.gas.value}/exec?text=${transcript}&source=ja&target=en`, {
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
        translatedTimeoutId = setTimeout(() => {
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
  } else {
    const remaining = form.isBracketed.checked ? `<< ${transcript} >>` : transcript;
    output.textContent = remaining;
    obs.send(JSON.stringify({
      "request-type": `SetText${form.type.value}Properties`,
      "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
      "source": form.src.value,
      "text": remaining,
    }));
  }
});

const afterConnected = () => {
  isRunning = true;
  output.textContent = "*READY*";
  translatedOutput.textContent = "";

  recog.timeout = Number(form.timeouttime.value);
  recog.interval = Number(form.heartbeattime.value);
  recog.start();
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
          document.querySelector("#bcout").textContent = `棒読みちゃんへ送信: [${built}]`;
          fetch(`http://localhost:${form.bouyomiChanTwitchPort.value}/talk?text=${built}`, { mode: "no-cors" })
            .catch(_ => {
              document.querySelector("#bcout").textContent = "棒読みちゃんとの接続に失敗しました。";
            });
        };
        twitch.join(form.bouyomiChanTwitchId.value.split(" "));
        twitch.addEventListener("chat", chat, false);

        const fuckoff = _ => {
          twitch.part();
          twitch.removeEventListener("chat", chat, false);
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
  recog.stop();
  clearTimeout(timeoutId);
  clearTimeout(translatedTimeoutId);
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
  document.dispatchEvent(new CustomEvent("twitchyousuck"));
};

form.submit.addEventListener("click", submit, false);

form.cancel.addEventListener("click", event => {
  event.preventDefault();
  cleanup();
  toggleAll();
}, false);

window.addEventListener("unload", _ => {
  cleanup();
  form.field.setAttlibute("disabled");
  if (yukarinette) yukarinette.close();
}, false);
