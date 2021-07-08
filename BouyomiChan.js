export class BouyomiChan {
  #port;

  constructor(port = 50080) {
    this.port = port;
  }

  send(str) {
    fetch(`http://localhost:${this.#port}/talk?text=${str}`, { mode: "no-cors" })
      .catch(e => { throw e })
  }

  #assertPort(port) {
    if (!Number.isSafeInteger(port))
      throw new TypeError("Invalid port");
  }

  set port(port) {
    this.#assertPort(port);
    this.#port = port;
  }
}
