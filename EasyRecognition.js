export class EasyRecognition extends EventTarget {
  #isFinal = false;
  #hasRequestedEnd = false;
  #recog = new webkitSpeechRecognition();

  constructor() {
    super();

    this.#recog.lang = globalThis.navigator.language;
    this.#recog.interimResults = true;
    this.#recog.continuous = true;

    this.#recog.addEventListener("end", event => {
      if (!this.#hasRequestedEnd) event.currentTarget.start();
    }, false);

    this.#recog.addEventListener("error", event => {
      if (this.#isFinal) event.currentTarget.start();
    }, false);

    this.#recog.addEventListener("result", event => {
      const currentResult = event.results[event.results.length - 1];
      this.#isFinal = currentResult.isFinal;
      this.dispatchEvent(new MessageEvent("message", {
        data: {
          transcript: currentResult[0].transcript,
          isFinal: currentResult.isFinal,
        }
      }));
    }, false);
  }

  start() {
    this.#hasRequestedEnd = false;
    this.#recog.start();
  }

  stop() {
    this.#hasRequestedEnd = true;
    this.#recog.stop();
  }
}
