import { Server as Server$1 } from 'node:http';
import { Server } from 'node:https';
import { t as toNodeListener, i as destr, u as useRuntimeConfig, k as trapUnhandledNodeErrors, l as setupGracefulShutdown, h as useNitroApp } from '../../../_/nitro.mjs';

const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
const nitroApp = useNitroApp();
const server = cert && key ? new Server({ key, cert }, toNodeListener(nitroApp.h3App)) : new Server$1(toNodeListener(nitroApp.h3App));
const port = destr(process.env.NITRO_PORT || process.env.PORT) || 3e3;
const host = process.env.NITRO_HOST || process.env.HOST;
const path = process.env.NITRO_UNIX_SOCKET;
const listener = server.listen(path ? { path } : { port, host }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const protocol = cert && key ? "https" : "http";
  const addressInfo = listener.address();
  if (typeof addressInfo === "string") {
    console.log(`Listening on unix socket ${addressInfo}`);
    return;
  }
  const baseURL = (useRuntimeConfig().app.baseURL || "").replace(/\/$/, "");
  const url = `${protocol}://${addressInfo.family === "IPv6" ? `[${addressInfo.address}]` : addressInfo.address}:${addressInfo.port}${baseURL}`;
  console.log(`Listening on ${url}`);
});
trapUnhandledNodeErrors();
setupGracefulShutdown(listener, nitroApp);
const nodeServer = {};

const content_get = /*#__PURE__*/Object.freeze({
  __proto__: null
});

const _slug__get = /*#__PURE__*/Object.freeze({
  __proto__: null
});

export { _slug__get as _, content_get as c, nodeServer as n };
//# sourceMappingURL=_slug_.get.mjs.map
