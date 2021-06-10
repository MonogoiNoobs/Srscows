import { Numerics } from "./Numerics.js";

export class TwitchIRCParser {
  #byCommandRegExp = /^(?:@(?<tags>[^\r\n \0]+) )?(?::(?<servername>localhost|[A-Za-z\d](?:[A-Za-z\d-]*[A-Za-z\d])?\.[A-Za-z\d](?:[A-Za-z\d-]*[A-Za-z\d])?(?:\.[A-Za-z\d](?:[A-Za-z\d-]*[A-Za-z\d])?)*) |:(?<nick>[A-Za-z\d][A-Za-z\d\[\]\\`^{}_-]*)(?:!(?<user>[A-Za-z\d~][A-Za-z\d\[\]\\`^{}_-]*))?(?:@(?<host>localhost|[A-Za-z\d][A-Za-z_\d-]*\.[A-Za-z\d](?:[A-Za-z_\d-]*[A-Za-z\d])?(?:\.[A-Za-z\d](?:[A-Za-z_\d-]*[A-Za-z\d])?)*))? )?(?<verb>\w+|\d{3})/;

  static Numerics = Numerics;

  #middleRegExp = /^[^: \0\r\n]*/;

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

  #isColonStarted(arg) {
    return arg[0] === ":";
  }

  #trimUndefined(obj) {
    return Object.fromEntries(
      Object.entries(obj)
        .flatMap(([k, v]) =>
          v && v.length !== 0
            ? [[k, v]]
            : []
        )
    );
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

  #parseParams(params, middles = []) {
    const paramsTrimmedFirstSpace = params.slice(1);
    if (this.#isColonStarted(paramsTrimmedFirstSpace))
      return {
        params: [
          ...middles,
          paramsTrimmedFirstSpace
            .trimEnd()
            .slice(1)
        ]
      };
    const prepareMiddle = this.#middleRegExp.exec(paramsTrimmedFirstSpace);
    if (!prepareMiddle || paramsTrimmedFirstSpace.length < 2)
      return { params: middles };
    const middle = prepareMiddle[0];
    return this.#parseParams(
      paramsTrimmedFirstSpace.replace(middle, ""),
      [...middles, middle]
    );
  }

  parse(response) {
    if (!(this.#isALine(response) && this.#isCRLFEnded(response)))
      throw new Error("Invalid syntax");
    const firstPass = response.match(this.#byCommandRegExp);
    const responsePreparedParseParams = response.replace(firstPass[0], "");
    const result = {
      tags: firstPass.groups.tags,
      source: this.#trimUndefined({
        servername: firstPass.groups.servername,
        nick: firstPass.groups.nick,
        user: firstPass.groups.user,
        host: firstPass.groups.host
      }),
      verb: firstPass.groups.verb,
      ...this.#parseParams(responsePreparedParseParams)
    };
    if (result.tags)
      result.tags = Object.fromEntries(this.#parseTags(result.tags));
    else
      result.tags = {};
    result.verb = this.#atoiIfNumber(result.verb);
    return result;
  }

  stringify(obj) {
    let first = "";

    if (Object.keys(obj.tags).length)
      first = `@${Object.entries(obj.tags).flatMap(v => [[this.#escapeIRCTagComponent(v[0]), v[1] === true ? [] : this.#escapeIRCTagComponent(v[1])].flat()]).flatMap(v => [v.join("=")]).join(";")} `;

    if (obj.source.hasOwnProperty("servername"))
      first += `:${obj.source.servername} `;
    else if (obj.source.hasOwnProperty("nick"))
      first += `:${obj.source.nick}${obj.source.hasOwnProperty("user") ? "!" + obj.source.user : ""}${obj.source.hasOwnProperty("host") ? "@" + obj.source.host : ""} `;

    return `${first}${obj.verb}${obj.params.flatMap(v => [` ${v}`]).join("")}${"\r\n"}`;
  }
}
