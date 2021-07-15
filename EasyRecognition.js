export class EasyRecognition extends EventTarget {
  isFinal = false;
  timeoutId = 0;
  intervalId = 0;
  timeout = 0;
  interval = 0;
  hasRequestedEnding = false;
  recog = new webkitSpeechRecognition() ?? new SpeechRecognition();

  constructor({ timeout, interval } = { timeout: 2000, interval: 5000 }) {
    super();
    this.recog.lang = globalThis.navigator.language;
    this.recog.interimResults = true;
    this.recog.continuous = true;

    this.timeout = Number(timeout);
    this.interval = Number(interval);

    this.recog.addEventListener("start", _ => {
      this.hasRequestedEnding = false;
      if (this.interval) this.intervalId = setInterval(this.intervalCallback.bind(this), this.interval);
    })

    this.recog.addEventListener("end", event => {
      clearTimeout(this.timeoutId);
      clearInterval(this.intervalId);
      if (!this.hasRequestedEnding) event.currentTarget.start();
    });

    this.recog.addEventListener("error", _ => {
      if (this.isFinal) event.currentTarget.start();
    });

    this.recog.addEventListener("result", event => {
      const currentResult = event.results[event.results.length - 1];
      this.isFinal = currentResult.isFinal;

      const message = {
        data: {
          transcript: currentResult[0].transcript,
          isFinal: currentResult.isFinal,
        }
      };

      clearTimeout(this.timeoutId);
      if (!this.isFinal && this.timeout) this.timeoutId = setTimeout(this.timeoutCallback.bind(this), this.timeout, currentResult[0].transcript)

      clearInterval(this.intervalId);
      if (this.interval) this.intervalId = setInterval(this.intervalCallback.bind(this), this.interval);

      this.dispatchEvent(new MessageEvent("message", message));
    }, false);
  }

  intervalCallback() {
    this.recog.stop();
  }

  timeoutCallback(transcript) {
    this.dispatchEvent(new MessageEvent("message", { data: { transcript, isFinal: true } }));
    this.isFinal = true;
    this.recog.stop();
  }

  start() {
    this.recog.start();
  }

  stop() {
    this.hasRequestedEnding = true;
    this.recog.stop();
  }

  set timeout(n) {
    this.timeout = Number(n);
  }

  get timeout() {
    return this.timeout;
  }

  set interval(n) {
    this.interval = Number(n);
  }

  get interval() {
    return this.interval;
  }
}
