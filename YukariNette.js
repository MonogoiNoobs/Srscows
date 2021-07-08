export class YukariNette extends WebSocket {
  constructor(port = 49513) {
    if (!Number.isSafeInteger(port))
      throw new TypeError("Invalid port");
    super(`http://localhost:${port}`);
  }

  send(str) {
    super.send(`0:${str}`);
  }
}
