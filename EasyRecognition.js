export class EasyRecognition extends EventTarget {
  timeoutId = 0;
  intervalId = 0;
  timeout = 0;
  interval = 0;
  isTimeoutFired = false;
  hasRequestedEnding = false;
  recog = new webkitSpeechRecognition() ?? new SpeechRecognition();

  constructor({ timeout, interval } = { timeout: 2000, interval: 5000 }) {
    super();
    this.recog.lang = navigator.language;
    this.recog.interimResults = true;
    this.recog.continuous = true;

    this.timeout = Number(timeout);
    this.interval = Number(interval);

    this.recog.addEventListener("start", _ => {
      this.hasRequestedEnding = false;

      if (this.interval)
        this.intervalId = setInterval(this.intervalCallback.bind(this), this.interval);
    })

    this.recog.addEventListener("end", event => {
      clearTimeout(this.timeoutId);
      clearInterval(this.intervalId);

      if (!this.hasRequestedEnding)
        event.currentTarget.start();
    });

    this.recog.addEventListener("result", event => {
      if (this.isTimeoutFired) {
        this.isTimeoutFired = false;
        return;
      }

      const currentResult = event.results[event.results.length - 1];
      const {
        0: {
          transcript
        },
        isFinal
      } = currentResult;

      clearTimeout(this.timeoutId);
      if (!isFinal && this.timeout)
        this.timeoutId = setTimeout(this.timeoutCallback.bind(this), this.timeout, transcript)

      clearInterval(this.intervalId);
      if (this.interval)
        this.intervalId = setInterval(this.intervalCallback.bind(this), this.interval);

      this.dispatchEvent(
        new MessageEvent("message", {
          data: {
            transcript,
            isFinal
          }
        })
      );
    }, false);
  }

  intervalCallback() {
    this.recog.stop();
  }

  timeoutCallback(transcript) {
    this.isTimeoutFired = true;
    this.dispatchEvent(
      new MessageEvent("message", {
        data: {
          transcript,
          isFinal: true
        }
      })
    );
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
