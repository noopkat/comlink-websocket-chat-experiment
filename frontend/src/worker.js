import * as Comlink from "comlink";

const smileys = new Map([
  [/:\)/g, "/images/smiley.png"]
]);

const api = {
  sayHello(name) {
    console.log(`Hello ${name}!`);
  },
  processMessage(message) {
    for(const [regexp, image] of smileys.entries()) {
      message = message.replace(regexp, `<img class="emoji" src="${image}">`);
    }
    return message;
  }
}

Comlink.expose(api);