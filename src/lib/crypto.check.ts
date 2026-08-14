import { passwordHash, passwordPreimage, poseidon, tag, PASSWORD_TAG } from "./crypto";

const a = passwordPreimage("年会快乐");
const b = passwordPreimage("年会快乐");
if (a !== b) throw new Error("stable");
if (passwordHash(a) === a) throw new Error("must domain-separate");
if (passwordPreimage("年会快乐") !== passwordPreimage(" 年会快乐 ")) throw new Error("trim");

const cairoPasswordHash7 = poseidon([tag(PASSWORD_TAG), 7n]);
if (cairoPasswordHash7 === 0n) throw new Error("poseidon zero");
const cairoRefund7 = poseidon([tag("SEALPACK_REFUND:V1"), 7n]);
if (cairoPasswordHash7 === cairoRefund7) throw new Error("tag collision");

console.log("password ok", a);
console.log("poseidon PASSWORD_TAG,7", "0x" + cairoPasswordHash7.toString(16));
