import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import net from "node:net";

function usage() {
  console.error("usage: preview-listener.mjs <pid|open> <port> | <command|cwd> <pid>");
  process.exit(2);
}

function listeningInodes(port) {
  const hex = port.toString(16).padStart(4, "0");
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n").slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const localPort = (parts[1] ?? "").split(":").at(-1) ?? "";
      if (parts[3] === "0A" && localPort.toLowerCase() === hex && parts[9] !== "0") inodes.add(parts[9]);
    }
  }
  return inodes;
}

function pidsForInodes(inodes) {
  const pids = new Set();
  let entries;
  try {
    entries = readdirSync("/proc");
  } catch {
    console.error("preview-listener needs /proc to find a listener pid");
    process.exit(1);
  }
  for (const entry of entries) {
    if (!/^[0-9]+$/.test(entry)) continue;
    let fds;
    try {
      fds = readdirSync(`/proc/${entry}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      try {
        const target = readlinkSync(`/proc/${entry}/fd/${fd}`);
        const match = /^socket:\[(\d+)\]$/.exec(target);
        if (match?.[1] && inodes.has(match[1])) pids.add(entry);
      } catch {
        continue;
      }
    }
  }
  return [...pids];
}

function portNumber(value) {
  if (!/^[0-9]+$/.test(value ?? "")) usage();
  const port = Number(value);
  if (port < 1 || port > 65535) usage();
  return port;
}

function listenerPids(port) {
  return pidsForInodes(listeningInodes(port));
}

function probe(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

const [action, argument] = process.argv.slice(2);
if (action === "pid") {
  const pids = listenerPids(portNumber(argument));
  if (pids.length !== 1) {
    console.error(`expected one listener on ${argument}, found ${pids.length}`);
    process.exit(1);
  }
  console.log(pids[0]);
} else if (action === "open") {
  const open = await probe(portNumber(argument));
  process.exit(open ? 0 : 1);
} else if (action === "command" || action === "cwd") {
  if (!/^[0-9]+$/.test(argument ?? "")) usage();
  try {
    if (action === "command") {
      console.log(readFileSync(`/proc/${argument}/cmdline`).toString("utf8").replaceAll("\0", " ").trim());
    } else {
      console.log(readlinkSync(`/proc/${argument}/cwd`));
    }
  } catch {
    console.error(`cannot read ${action} for pid ${argument}`);
    process.exit(1);
  }
} else {
  usage();
}
