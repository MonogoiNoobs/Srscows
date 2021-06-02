"use strict";

const obs = new OBSWebSocket();

let recog;

let timeoutId = null;
let translatedTimeoutId = null;

const output = document.querySelector("#stdout");
const translatedOutput = document.querySelector("#trans");
const form = document.forms.main.elements;

const toggleAll = () => {
  for (const element of document.forms.main.querySelectorAll("[id]")) {
    element.toggleAttribute("disabled");
  }
  form.field.toggleAttribute("disabled");
};

const submit = event => {
  event.preventDefault();
  toggleAll();

  obs.connect({
    address: `localhost:${form.port.value}`,
    password: form.pass.value,
  })
    .then(() => {
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

          if (!(timeoutId || isFinal)) {
            if (Number(form.fadetime.value)) {
              globalThis.clearTimeout(timeoutId);
              timeoutId = null;
            }
            if (Number(form.transfadetime.value)) {
              globalThis.clearTimeout(translatedTimeoutId);
              translatedTimeoutId = null;
            }
          }

          output.textContent = latestTranscript;
          obs.send(`SetText${form.type.value}Properties`, {
            source: form.src.value,
            text: latestTranscript,
          });

          if (!isFinal) return;

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
      toggleAll();
      output.textContent = `[ERROR] ${err.error}`;
      if (recog) recog.stop();
    });
};

const cleanup = () => {
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
}, false);
