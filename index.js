"use strict";

const obs = new OBSWebSocket();

let recog;

let timeoutId = null;
let translatedTimeoutId = null;

let yukarinette = null;

let isRunning = false;

const output = document.querySelector("#stdout");
const translatedOutput = document.querySelector("#trans");
const form = document.forms.main.elements;

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

  obs.connect({
    address: `localhost:${form.port.value}`,
    password: form.pass.value,
  })
    .then(() => {
      isRunning = true;
      output.textContent = "*READY*";
      let isSpeaking = false;

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

          output.textContent = form.isBracketed.checked ? `<< ${latestTranscript} >>` : latestTranscript;
          obs.send(`SetText${form.type.value}Properties`, {
            source: form.src.value,
            text: form.isBracketed.checked ? `<< ${latestTranscript} >>` : latestTranscript,
          });

          if (!isFinal) return;

          if (form.isBracketed.checked) {
            output.textContent = latestTranscript;
            obs.send(`SetText${form.type.value}Properties`, {
              source: form.src.value,
              text: latestTranscript,
            });
          }

          if (form.hasYukarinette.checked && !!yukarinette) yukarinette.send(`0:${latestTranscript}`);

          if (form.isTranslation.checked) {
            fetch(`https://script.google.com/macros/s/${form.gas.value}/exec?text=${latestTranscript}&source=ja&target=en`, {
              mode: "cors",
            })
              .then(res => res.text())
              .then(translatedTranscript => {
                translatedOutput.textContent = translatedTranscript;
                obs.send(`SetText${form.type.value}Properties`, {
                  source: form.transrc.value,
                  text: translatedTranscript,
                });
                if (Number(form.transfadetime.value)) {
                  translatedTimeoutId = globalThis.setTimeout(() => {
                    translatedOutput.textContent = "";
                    obs.send(`SetText${form.type.value}Properties`, {
                      source: form.transrc.value,
                      text: "",
                    });
                  }, Number(form.transfadetime.value));
                }
              });
          }

          if (Number(form.fadetime.value)) {
            timeoutId = globalThis.setTimeout(() => {
              output.textContent = "";
              obs.send(`SetText${form.type.value}Properties`, {
                source: form.src.value,
                text: "",
              });
            }, Number(form.fadetime.value));
          }

          isSpeaking = false;
          makeRecognition();

        };

        recog.start();
      };

      makeRecognition();
    })
    .catch(err => {
      isRunning = false;
      toggleAll();
      output.textContent = `[ERROR] ${err.error}`;
      if (recog) recog.stop();
    });
};

const cleanup = () => {
  isRunning = false;
  obs.send(`SetText${form.type.value}Properties`, {
    source: form.src.value,
    text: "",
  });
  output.textContent = "";
  if (form.isTranslation.checked) {
    obs.send(`SetText${form.type.value}Properties`, {
      source: form.transrc.value,
      text: "",
    });
    translatedOutput.textContent = "";
  }
  obs.disconnect();
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
