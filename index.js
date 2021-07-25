/**
 * @license 0BSD
 */

import { TwitchChatVisitor } from "./TwitchChatVisitor.js";
import { EasyRecognition } from "./EasyRecognition.js";

let obs = null;

const recog = new EasyRecognition();

let timeoutId = 0;
let translatedTimeoutId = 0;

let yukarinette = null;

const japaneseSpacesRegExp = /(?<=[^!-~])\s(?=[^!-~])/gu;
const strangeSpacesRegExp = /(?:(?<=[!-~])\s(?=[^!-~])|(?<=[^!-~])\s(?=[!-~]))/gu;

const output = document.querySelector("#stdout");
const translatedOutput = document.querySelector("#trans");
const form = document.forms.main.elements;

const digest = async str => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)))))

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

const submit = async event => {
  event.preventDefault();
  toggleAll();

  if (!isValid(document.forms.main.elements)) {
    toggleAll();
    return;
  }

  if (form.bouyomiChanHasTwitch.checked) {
    const twitch = await TwitchChatVisitor
      .connect()
      .catch(e => {
        document.querySelector("#bcout").textContent = `Twitch との接続に失敗しました: ${e}`;
      });

    const chat = event => {
      const built = encodeURIComponent(`${event.data.name}${form.bouyomiChanTwitchHonorific.value}、${event.data.chat}`);
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
  }

  if (form.hasYukarinette.checked && !yukarinette) {
    yukarinette = new WebSocket(`ws://localhost:${form.yukarinettePort.value}`);
    yukarinette.addEventListener("open", _ => {
      document.querySelector("#ykout").textContent = "ゆかりねっとに接続しました。";
    });
    yukarinette.addEventListener("error", _ => {
      document.querySelector("#ykout").textContent = "ゆかりねっととの接続に失敗しました。";
      yukarinette = null;
    });
  }

  obs = new WebSocket(`ws://localhost:${form.port.value}`);

  obs.addEventListener("open", event => {
    event.currentTarget.send(JSON.stringify({
      "request-type": "GetAuthRequired",
      "message-id": "srscows-getauthrequired",
    }));
  }, { once: true })

  obs.addEventListener("message", async event => {
    const message = JSON.parse(event.data);

    if (message.hasOwnProperty("error")) {
      event.currentTarget.dispatchEvent(new ErrorEvent("error", { message: message.error }));
      return;
    }

    switch (message["message-id"]) {
      case "srscows-getauthrequired": {
        if (message.authRequired) {
          const auth = await digest(`${await digest(`${form.pass.value}${message.salt}`)}${message.challenge}`);
          event.currentTarget.send(JSON.stringify({
            "request-type": "Authenticate",
            "message-id": "srscows-authenticate",
            auth,
          }));
        } else {
          afterConnected();
        }
      } break;

      case "srscows-authenticate": {
        afterConnected();
      } break;

      default: break;
    }
  })

  obs.addEventListener("error", event => {
    toggleAll();
    output.textContent = `[ERROR] ${event.message ?? "OBS が起動していないか、ポート番号が間違っています。"}`;
    cleanup();
  }, { once: true })
};


const cleanup = () => {
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
  form.field.setAttribute("disabled");
  if (yukarinette) yukarinette.close();
}, false);
