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
let isSpeaking = false;

const output = document.querySelector("#stdout");
const translatedOutput = document.querySelector("#trans");
const form = document.forms.main.elements;

const hashPromise = arg => crypto.subtle.digest("SHA-256", new TextEncoder().encode(arg));

const buftob = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

const toggleAll = () => {
  for (const element of document.forms.main.querySelectorAll("[id]")) {
    element.toggleAttribute("disabled");
  }
  form.field.toggleAttribute("disabled");
  if (yukarinette) {
    form.yukarinettePort.removeAttribute("disabled");
    form.yukarinettePort.setAttribute("disabled", "disabled");
  }
};

const makeRecognition = () => {
  recog = Object.assign(new webkitSpeechRecognition(), {
    lang: globalThis.navigator.language,
    interimResults: true,
    continuous: true,
  });

  recog.onerror = _ => {
    if (!isSpeaking) makeRecognition();
  }

  recog.onsoundend = _ => {
    makeRecognition();
  }

  recog.onresult = event => {
    isSpeaking = true;
    const latestTranscript = event.results[event.results.length - 1][0].transcript;
    const isFinal = event.results[event.results.length - 1].isFinal;

    if (timeoutId) globalThis.clearTimeout(timeoutId);
    if (translatedTimeoutId) globalThis.clearTimeout(translatedTimeoutId);

    const remaining = form.isBracketed.checked ? `<< ${latestTranscript} >>` : latestTranscript;
    output.textContent = remaining;
    obs.send(JSON.stringify({
      "request-type": `SetText${form.type.value}Properties`,
      "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
      "source": form.src.value,
      "text": remaining,
    }));

    if (!isFinal) return;

    if (form.isBracketed.checked) {
      output.textContent = latestTranscript;
      obs.send(JSON.stringify({
        "request-type": `SetText${form.type.value}Properties`,
        "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
        "source": form.src.value,
        "text": latestTranscript,
      }));
    }

    if (form.hasYukarinette.checked && !!yukarinette) yukarinette.send(`0:${latestTranscript}`);

    if (form.isTranslation.checked) {
      fetch(`https://script.google.com/macros/s/${form.gas.value}/exec?text=${latestTranscript}&source=ja&target=en`, {
        mode: "cors",
      })
        .then(res => res.text())
        .then(translatedTranscript => {
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
        });
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

    isSpeaking = false;
    makeRecognition();

  };

  recog.start();
};

const afterConnected = () => {
  isRunning = true;
  output.textContent = "*READY*";
  isSpeaking = false;

  makeRecognition();
}

const submit = event => {
  event.preventDefault();
  toggleAll();

  if (form.hasYukarinette.checked && !!!yukarinette) {
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
            hashPromise(`${buftob(passsalt)}${message.challenge}`).then(auth => {
              obs.send(JSON.stringify({
                "request-type": "Authenticate",
                "message-id": "srscows-authenticate",
                auth: buftob(auth),
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
    output.textContent = `[ERROR] ${event.message}`;
    if (recog) recog.stop();
    if (obs) {
      obs.close();
      obs = null;
    }
  };
};


const cleanup = () => {
  isRunning = false;
  obs.send(JSON.stringify({
    "request-type": `SetText${form.type.value}Properties`,
    "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
    "source": form.src.value,
    "text": "",
  }));
  output.textContent = "";
  if (form.isTranslation.checked) {
    obs.send(JSON.stringify({
      "request-type": `SetText${form.type.value}Properties`,
      "message-id": `srscows-settext${form.type.value.toLowerCase()}properties`,
      "source": form.transrc.value,
      "text": "",
    }));
    translatedOutput.textContent = "";
  }
  obs.close();
  obs = null;
  if (recog) recog.stop();
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
