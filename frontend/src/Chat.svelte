<script>
  import * as Comlink from "comlink";
  // import {wrap} from "./string-channel.js";

  function websocketEndpoint(ws) {
    return wrap({
      addMessageListener(f) {
        ws.addEventListener("message", ev => f(ev.data));
      },
      send(msg) {
        ws.send(msg);
      }
    });
  }

  function websocketReady(ws) {
    return new Promise(resolve => {
      ws.addEventListener("open", resolve, {once: true});
    })
  }

  // (async function () {
  //   const ws = new WebSocket(`ws://${location.host}/ws2`);
  //   await websocketReady(ws);
  //   const api = Comlink.wrap(websocketEndpoint(ws))
  //   alert(await api.doMath(40, 2));
  // })()

  const worker = new Worker("/build/worker.js");
  const api = Comlink.wrap(worker);
  api.sayHello("Surma");

  const onSendMessage = (event) => {
    ws.send(messageInput);
    messageInput = "";
  }
  let messageList = [];
  let messageInput = "";

  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.addEventListener("message", async ev => {
    messageList = [...messageList, await api.processMessage(ev.data)];
  });

</script>

<style>
  :global(.emoji) {
    width: 1em;
    height: 1em;
    display: inline-block;
  }
</style>

<div id="chatwrapper">
  <div id="chatOutput">
    {#each messageList as message} 
      <div>
        {@html message}
      </div>

    {/each}
  </div>
  <form on:submit|preventDefault={onSendMessage}>
    <input bind:value={messageInput} aria-label="type a message" />
    <input type="submit" value="Send" />
  </form>
</div>