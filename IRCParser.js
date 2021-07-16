import { Verbs } from "./Verbs.js";
import { Numerics } from "./Numerics.js";

export class IRCParser {
  static Verbs = Verbs;
  static Numerics = Numerics;

  #doesParseSources = true;
  #doesTryAtoi = true;
  #doesRequireStrictHost = true;
  #doesRequireCRLFEnded = true;
  #doesTryConvertKebabTagKeysToCamel = true;

  #hostRegExp = /^(?:localhost|(?:[12]\d{2}|[1-9]\d|[1-9])(?:\.(?:[12]\d{2}|[1-9]\d|\d)){3}|(?:(?:[a-z\d][_a-z\d-]*[a-z\d]|[a-z\d])(?:\.[a-z\d][_a-z\d-]*[a-z\d]|\.[a-z\d])+))$/iu;

  constructor(obj) {
    this.#doesParseSources = obj?.doesParseSources ?? true;
    this.#doesTryAtoi = obj?.doesTryAtoi ?? true;
    this.#doesRequireStrictHost = obj?.doesRequireStrictHost ?? true;
    this.#doesRequireCRLFEnded = obj?.doesRequireCRLFEnded ?? true;
    this.#doesTryConvertKebabTagKeysToCamel = obj?.doesTryConvertKebabTagKeysToCamel ?? true;
  }

  #escapeIRCTagComponent(arg) {
    return Array.from(arg).flatMap(v => {
      if (v === "\\") return ["\\", "\\"];
      if (v === " ") return ["\\", "s"];
      if (v === ";") return ["\\", ":"];
      if (v === "\r") return ["\\", "r"];
      if (v === "\n") return ["\\", "n"];
      return v;
    }).join("")
  }

  #unescapeIRCTagComponent(arg) {
    const array = Array.from(arg).map(v => [v]);
    for (const [i, v] of array.entries()) {
      if (v[0] === "\\") {
        v[0] =
          i + 1 === array.length ? [] :
            array[i + 1][0] === ":" ? ";" :
              array[i + 1][0] === "s" ? " " :
                array[i + 1][0] === "n" ? "\n" :
                  array[i + 1][0] === "r" ? "\r" :
                    array[i + 1][0];
        array[i + 1] = [];
      }
    }
    return array.flat().join("");
  }

  #atoiIfNumber(str) {
    if (!this.#doesTryAtoi) return str;
    return Number.isNaN(Number(str)) ? str : Number(str);
  }

  #parseTags(str) {
    return Object.fromEntries(str.split(";").map(v => {
      let [key, ...value] = this.#unescapeIRCTagComponent(v).split("=");
      key = this.#doesTryConvertKebabTagKeysToCamel ? key.replace(/-./g, x => x.toUpperCase()[1]) : key;
      value = value.length
        ? value.join("")
        : "";
      return [key, value];
    }));
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
      return { nick: arg };

    [arg, result] = this.#popDatumAfterDelimiterTo("host", arg, result, "@");
    [arg, result] = this.#popDatumAfterDelimiterTo("user", arg, result, "!");

    if (this.#doesRequireStrictHost && this.#hasProperty(result, "host") && !this.#hostRegExp.test(result.host))
      throw new TypeError("Invalid host");

    return {
      nick: arg,
      ...result
    };
  }

  parse(arg) {
    if (!arg.trim()) return {};

    if (this.#doesRequireCRLFEnded && !arg.endsWith("\r\n"))
      throw new Error("Invalid syntax");

    arg = arg.replace(/\r\n$/, "");

    const result = {
      verb: "",
      params: [],
      // hasTrailing: false
    };

    parsing:
    for (let splitted = arg.split(" "), v = splitted.shift(), gotVerb = false; v !== void 0; v = splitted.shift()) {
      // console.log(splitted.length)
      switch (v[0]) {
        case "@":
          result.tags = this.#parseTags(v.slice(1));
          break;

        case ":":
          if (gotVerb) {
            result.params.push([v, ...splitted].join(" ").slice(1));
            // result.hasTrailing = true;
            break parsing;
          }
          result.source = this.#doesParseSources ? this.#parseSource(v.slice(1)) : v.slice(1);
          break;

        default:
          if (v === "") break;
          if (gotVerb) {
            result.params.push(v);
            break;
          }
          result.verb = this.#atoiIfNumber(v);
          gotVerb = true;
          break;
      }
    }

    if (!result.params.length) {
      delete result.params;
      // delete result.hasTrailing;
    }

    return result;
  }

  #hasProperty(obj, str) {
    return {}.propertyIsEnumerable.call(obj, str);
  }

  stringify(obj) {
    let result = "";

    if (this.#hasProperty(obj, "tags") && Object.keys(obj.tags).length) {
      result += "@";
      result += Object
        .entries(obj.tags)
        .map(v => [this.#escapeIRCTagComponent(v[0]), v[1] ? this.#escapeIRCTagComponent(v[1]) : []].flat())
        .map(v => v.join("="))
        .join(";");
      result += " ";
    }

    if (this.#hasProperty(obj, "source")) {
      result += ":";

      if (typeof obj.source === "string") {
        result += obj.source;
      } else {
        result += this.#hasProperty(obj.source, "nick") ? obj.source.nick : "";
        result += this.#hasProperty(obj.source, "user") ? "!" + obj.source.user : "";
        result += this.#hasProperty(obj.source, "host") ? "@" + obj.source.host : "";
        if (this.#doesRequireStrictHost && this.#hasProperty(obj.source, "host") && !this.#hostRegExp.test(obj.source.host))
          throw new TypeError("Invalid host");
      }

      result += " ";
    }

    result += `${obj.verb}`;

    if (this.#hasProperty(obj, "params")) {
      result += " ";
      result += obj
        .params
        .map(v => {
          if (v.includes(" ") && v !== obj.params[obj.params.length - 1])
            throw new Error("Invalid params");
          return (!this.#hasProperty(obj, "hasTrailing") || obj.hasTrailing) && v === obj.params[obj.params.length - 1] ? `:${v}` : v;
        })
        .join(" ");
    }

    if (this.#doesRequireCRLFEnded) result += "\r\n";

    return result;
  }
}
