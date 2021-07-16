export class BouyomiChan {
  #port;

  constructor(port = 50080) {
    this.port = Number(port);
  }

  async send(str) {
    await fetch(`http://localhost:${this.#port}/talk?text=${str}`, { mode: "no-cors" })
      .catch(e => { throw e })
  }

  get port() {
    return this.#port;
  }

  set port(port) {
    if (Number(port) >= 2 ** 16) throw new TypeError("Invalid port");
    this.#port = Number(port);
  }
}
