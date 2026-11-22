import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { EF, type WsMessage } from "./constants.js";
import {
  allowedPreviewPorts,
  handlePreviewWsClose,
  handlePreviewWsData,
  handlePreviewWsOpen,
} from "./preview.js";

let server: ReturnType<typeof Bun.serve>;
let port: number;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req, srv) {
      if (srv.upgrade(req)) return;
      return new Response("ok");
    },
    websocket: {
      message(ws, msg) {
        ws.send(msg);
      },
    },
  });
  port = server.port!;
});

afterAll(() => {
  server.stop(true);
});

const waitFor = async (pred: () => boolean, ms = 2000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (pred()) return;
    await Bun.sleep(10);
  }
  throw new Error("timeout waiting for condition");
};

describe("edge preview WS relay", () => {
  test("rejects unregistered port", async () => {
    const sent: WsMessage[] = [];
    await handlePreviewWsOpen(
      { streamId: "s-unreg", port: 59999, path: "/" },
      async (m) => { sent.push(m); },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe(EF.PREVIEW_WS_OPENED);
    expect((sent[0].payload as any).error).toContain("not registered");
  });

  test("relays text and binary frames and closes cleanly", async () => {
    allowedPreviewPorts.add(port);
    const sent: WsMessage[] = [];
    const send = async (m: WsMessage) => { sent.push(m); };

    await handlePreviewWsOpen({ streamId: "s1", port, path: "/ws" }, send);
    await waitFor(() => sent.some((m) => m.type === EF.PREVIEW_WS_OPENED));
    expect((sent[0].payload as any).error).toBeUndefined();

    // Text echo
    handlePreviewWsData({ streamId: "s1", binary: false, text: "ping-hmr" });
    await waitFor(() => sent.some((m) => m.type === EF.PREVIEW_WS_DATA && (m.payload as any).text === "ping-hmr"));

    // Binary echo
    const raw = Buffer.from([0x00, 0x01, 0xfe, 0xff]);
    handlePreviewWsData({ streamId: "s1", binary: true, dataB64: raw.toString("base64") });
    await waitFor(() => sent.some((m) => m.type === EF.PREVIEW_WS_DATA && (m.payload as any).binary === true));
    const binMsg = sent.find((m) => m.type === EF.PREVIEW_WS_DATA && (m.payload as any).binary === true)!;
    expect(Buffer.from((binMsg.payload as any).dataB64, "base64").equals(raw)).toBe(true);

    // Close
    handlePreviewWsClose({ streamId: "s1", code: 1000 });
  });
});
