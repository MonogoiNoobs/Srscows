import { Verbs } from "./Verbs.js";
import { Numerics } from "./Numerics.js";

export class TwitchIRCParser {
  static Verbs = Verbs;
  static Numerics = Numerics;

  #IRCTagEscapingValueEntries = [
    [";", "\\:"],
    [" ", "\\s"],
    ["\\", "\\\\"],
    ["\r", "\\r"],
    ["\n", "\\n"],
  ];

  #IRCTagEscapingValueMap = new Map(this.#IRCTagEscapingValueEntries);
  #IRCTagUnescapingValueMap = new Map(this.#flipEntries(this.#IRCTagEscapingValueEntries));

  constructor() { }

  #flipEntries(array) {
    return array.flatMap(v => [[v[1], v[0]]]);
  }

  #unitArrayValues(arg) {
    return arg.flatMap(v => [[v]]);
  }

  #escapingCallback(map) {
    return v => map.has(v[0]) ? map.get(v[0]) : v[0];
  }

  #replaceEscapings(arr, map) {
    return arr.flatMap(this.#escapingCallback(map));
  }

  #escapeIRCTagComponent(arg) {
    return this.#replaceEscapings(
      this.#unitArrayValues(Array.from(String(arg))),
      this.#IRCTagEscapingValueMap
    ).join("");
  }

  #unescapeIRCTagComponent(arg) {
    let result = [];
    for (let i = 0; i < arg.length; ++i) {
      if (arg[i] === "\\") {
        result = [...result, [`${arg[i]}${arg[i + 1]}`]];
        ++i;
      } else result = [...result, [arg[i]]];
    }
    return this.#replaceEscapings(
      result,
      this.#IRCTagUnescapingValueMap
    ).join("");
  }

  #isCRLFEnded(response) {
    return response.slice(response.length - 2) === "\r\n";
  }

  #isALine(response) {
    return response.includes("\r\n") && response.match(/\r\n/g).length === 1;
  }

  #atoiIfNumber(str) {
    return Number.isNaN(Number(str)) ? str : Number(str);
  }

  #parseTags(str) {
    return str.split(";").flatMap(v => {
      const [_key, ..._value] = v.split("=");
      let key = this.#unescapeIRCTagComponent(_key);
      let value = _value.join("")
        ? this.#unescapeIRCTagComponent(_value.join(""))
        : null;
      key = this.#atoiIfNumber(key);
      value = this.#atoiIfNumber(value);
      return [[key, v.split("=")[1] ? value : true]];
    });
  }

  #popDatumAfterDelimiterTo(prop, input, output, delimiter) {
    const delimiterPos = input.indexOf(delimiter);
    if (delimiterPos !== -1) {
      output[prop] = input.slice(delimiterPos + 1);
      input = input.slice(0, delimiterPos);
    }
    return [input, output];
  }

  #parseSource(arg) {
    let result = {};
    if (!(arg.includes("!") || arg.includes("@")))
      return arg;

    [arg, result] = this.#popDatumAfterDelimiterTo("host", arg, result, "@");
    [arg, result] = this.#popDatumAfterDelimiterTo("user", arg, result, "!");

    return {
      nickname: arg,
      ...result
    };
  }

  parse(arg) {
    if (!(this.#isALine(arg) || this.#isCRLFEnded(arg)))
      throw new Error("Invalid syntax");

    arg = arg.replace(/\r\n$/, "");

    const result = {
      verb: "",
      params: [],
      hasTrailing: false
    };

    parsing:
    for (let splitted = arg.split(" "), v = splitted.shift(), gotVerb = false; v; v = splitted.shift()) {
      switch (v[0]) {
        case "@":
          result.tags = Object.fromEntries(this.#parseTags(v.slice(1)));
          break;

        case ":":
          if (gotVerb) {
            result.params = [
              ...result.params,
              [v, ...splitted]
                .join(" ")
                .slice(1)
            ];
            result.hasTrailing = true;
            break parsing;
          }
          result.source = this.#parseSource(v.slice(1));
          break;

        default:
          if (gotVerb) {
            result.params = [...result.params, v];
            break;
          }
          result.verb = this.#atoiIfNumber(v);
          gotVerb = true;
          break;
      }
    }

    if (!result.params.length)
      delete result.params, delete result.hasTrailing;

    return result;
  }

  #hasProperty(obj, str) {
    return {}.propertyIsEnumerable.call(obj, str);
  }

  stringify(obj) {
    let first = "";

    if (this.#hasProperty(obj, "tags") && Object.keys(obj.tags).length)
      first = `@${Object.entries(obj.tags).flatMap(v => [[this.#escapeIRCTagComponent(v[0]), v[1] === true ? [] : this.#escapeIRCTagComponent(v[1])].flat()]).flatMap(v => [v.join("=")]).join(";")} `;

    if (this.#hasProperty(obj, "source"))
      if (typeof obj.source === "string")
        first += `:${obj.source} `;
      else
        first += `:${obj.source.nickname}${this.#hasProperty(obj.source, "user") ? "!" + obj.source.user : ""}${this.#hasProperty(obj.source, "host") ? "@" + obj.source.host : ""} `;

    return `${first}${obj.verb}${obj.params.flatMap(v => {
      if (v.includes(" ") && v !== obj.params[obj.params.length - 1])
        throw new Error("Invalid params");
      return [` ${obj.hasTrailing && v === obj.params[obj.params.length - 1] ? `:${v}` : v}`];
    }).join("")}${"\r\n"}`;
  }
}
