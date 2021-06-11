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

  #parseSource(arg) {
    const result = {};
    if (!(arg.includes("!") || arg.includes("@")))
      return arg;
    if (arg.indexOf("@") !== -1) {
      result.host = arg.slice(arg.indexOf("@") + 1);
      arg = arg.slice(0, arg.indexOf("@"));
    }
    if (arg.indexOf("!") !== -1) {
      result.user = arg.slice(arg.indexOf("!") + 1);
      arg = arg.slice(0, arg.indexOf("!"));
    }

    return {
      nickname: arg,
      ...result
    };
  }

  parse(arg) {
    let gotVerb = false;
    const result = {
      tags: {},
      source: {},
      verb: "",
      params: [],
      hasTrailing: false
    };
    const splitted = arg.split(" ");
    let v;

    parsing:
    while (v = splitted.shift()) {
      console.log(v)
      switch (v[0]) {
        case "@":
          result.tags = Object.fromEntries(this.#parseTags(v.slice(1)));
          break;

        case ":":
          if (gotVerb) {
            result.params = [...result.params, [v, ...splitted].join(" ").slice(1).trimEnd()];
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
    return result;
  }

  stringify(obj) {
    let first = "";

    if (obj.hasOwnProperty("tags") && Object.keys(obj.tags).length)
      first = `@${Object.entries(obj.tags).flatMap(v => [[this.#escapeIRCTagComponent(v[0]), v[1] === true ? [] : this.#escapeIRCTagComponent(v[1])].flat()]).flatMap(v => [v.join("=")]).join(";")} `;

    if (obj.hasOwnProperty("source")) {
      if (obj.source.hasOwnProperty("servername"))
        first += `:${obj.source.servername} `;
      else if (obj.source.hasOwnProperty("nick"))
        first += `:${obj.source.nick}${obj.source.hasOwnProperty("user") ? "!" + obj.source.user : ""}${obj.source.hasOwnProperty("host") ? "@" + obj.source.host : ""} `;
    }
    return `${first}${obj.verb}${obj.params.flatMap(v => {
      if (v.includes(" ") && v !== obj.params[obj.params.length - 1])
        throw new Error("Invalid params");
      return [` ${obj.hasTrailing && v === obj.params[obj.params.length - 1] ? `:${v}` : v}`];
    }).join("")}${"\r\n"}`;
  }
}
