import { claimLeaves, committedLeaves, creatorHash, passwordHash, passwordPreimage, poseidon, tag, PASSWORD_TAG } from "./crypto";
import { merkleHeight, merkleProof, merkleRoot, merkleVerify } from "./merkle";

const a = passwordPreimage("年会快乐");
const b = passwordPreimage("年会快乐");
if (a !== b) throw new Error("stable");
if (passwordHash(a) === a) throw new Error("must domain-separate");
if (passwordPreimage("年会快乐") !== passwordPreimage(" 年会快乐 ")) throw new Error("trim");

const cairoPasswordHash7 = poseidon([tag(PASSWORD_TAG), 7n]);
if (cairoPasswordHash7 === 0n) throw new Error("poseidon zero");
const cairoRefund7 = poseidon([tag("SEALPACK_REFUND:V1"), 7n]);
if (cairoPasswordHash7 === cairoRefund7) throw new Error("tag collision");
const cairoCreator7 = poseidon([tag("SEALPACK_CREATOR:V1"), 7n]);
if (cairoCreator7 === cairoPasswordHash7) throw new Error("creator tag collision");
if (BigInt(creatorHash("0x7")) !== cairoCreator7) throw new Error("creatorHash helper");

console.log("password ok", a);
console.log("poseidon PASSWORD_TAG,7", "0x" + cairoPasswordHash7.toString(16));

const pair = merkleRoot([1n, 2n]);
if (pair !== "0x371cb6995ea5e7effcd2e174de264b5b407027a75a231a70c2c8d196107f0e7") {
  throw new Error("hashPair vector");
}
if (!merkleVerify(1n, merkleProof([1n, 2n], 0), pair)) throw new Error("proof 0");

if (merkleHeight(1) !== 0) throw new Error("height 1");
if (merkleHeight(2) !== 1) throw new Error("height 2");
if (merkleHeight(3) !== 2) throw new Error("height 3");
if (merkleHeight(50) !== 6) throw new Error("height 50");

const one = claimLeaves("0x7", 1);
const oneCommitted = committedLeaves(one);
const oneRoot = merkleRoot(oneCommitted);
if (oneRoot === one[0]) throw new Error("1-share root must not equal raw ticket");
if (merkleVerify(one[0], [], oneRoot)) throw new Error("raw ticket must not verify");
if (!merkleVerify(oneCommitted[0], merkleProof(oneCommitted, 0), oneRoot)) throw new Error("1-share committed");
if (merkleProof(oneCommitted, 0).length !== 0) throw new Error("1-share empty proof");

const three = claimLeaves("0x7", 3);
const threeCommitted = committedLeaves(three);
const threeRoot = merkleRoot(threeCommitted);
const threeProof = merkleProof(threeCommitted, 0);
if (threeProof.length !== 2) throw new Error("3-share height");
if (!merkleVerify(threeCommitted[0], threeProof, threeRoot)) throw new Error("3-leaf committed proof");
if (merkleVerify(three[0], threeProof, threeRoot)) throw new Error("raw ticket must not verify as committed leaf");
if (threeProof[0] !== threeCommitted[1]) throw new Error("sibling must be committed leaf");
console.log("merkle 3-leaf committed root", threeRoot);
