export class FormDataCollector extends EventTarget {
  #formId;
  constructor(formId = "#main") {
    super();

    this.#formId = formId;

    this.addEventListener("collect", event => {
      const data = Object.fromEntries(Array.from(document.querySelectorAll(`${this.#formId} input`))
        .map(input => {
          const result = [input.id];
          switch (input.type.toLowerCase()) {
            case "checkbox":
              result.push(input.checked);
              break;
            case "number":
              result.push(Number(input.value));
              break;
            default:
              result.push(input.value);
          }
          return result;
        }));
      event.currentTarget.dispatchEvent(new MessageEvent("formdata", {
        data
      }));
    });
  }
}
