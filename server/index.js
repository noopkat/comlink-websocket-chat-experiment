const express = require("express");
const app = express();
const wsapp = require("express-ws")(app);
const Comlink = require("comlink");
const nodeEndpoint = require("comlink/dist/umd/node-adapter.js");
const {wrap} = require("./string-channel.js");

const { MessageChannel, MessagePort } = require("worker_threads");
globalThis.MessageChannel = MessageChannel;
globalThis.MessagePort = MessagePort;

function websocketEndpoint(ws) {
  return nodeEndpoint(
    wrap({
      addMessageListener(f) {
        ws.addEventListener("message", ev => f(ev.data));
      },
      send(msg) {
        ws.send(msg);
      }
    })
  );
}

const listeners = new Set();

class ChatClient {
  setName(name) {
    this._name = name;
  }
  sendMessage() {
    if(!this._name) {
      return;
    }
  }
}

app.ws("/ws2", (ws, req) => {
  Comlink.expose(new ChatClient(), websocketEndpoint(ws));
});

app.ws("/ws", (ws, req) => {
  listeners.add(ws);
  ws.on("message", data => {
    for (const listener of listeners) {
      if (listener === ws) {
        // Don’t send message to yourself.
        continue;
      }
      listener.send(data);
    }
  });
  ws.on("close", () => {
    listeners.delete(ws);
  });
});
app.use("/", express.static("../frontend/public"));

app.listen(8081);





app.get("/test", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!doctype html>
    <input type="text">
    <button>send</button>
    <pre></pre>
    <script>
      const output = document.querySelector("pre");
      const input = document.querySelector("input");
      const ws = new WebSocket(\`ws://\${location.host}/ws\`);
      ws.addEventListener("message", ev => {
        output.innerHTML += ev.data + "\\n";
      });
      document.querySelector("button").onclick = () => {
        ws.send(input.value);
        input.value = "";
      };
    </script>
  `);
});
