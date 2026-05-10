const C240 = 0x1BD11BDAA9FC1A22n;

const ROT_256 = [
  [14n, 16n],
  [52n, 57n],
  [23n, 40n],
  [5n, 37n],
  [25n, 33n],
  [46n, 12n],
  [58n, 22n],
  [32n, 32n]
];

const ROT_512 = [
  [46n, 36n, 19n, 37n],
  [33n, 27n, 14n, 42n],
  [17n, 49n, 36n, 39n],
  [44n, 9n, 54n, 56n],
  [39n, 30n, 34n, 24n],
  [13n, 50n, 10n, 17n],
  [25n, 29n, 39n, 43n],
  [8n, 35n, 56n, 22n]
];

const ROT_1024 = [
  [24n, 13n, 8n, 47n, 8n, 17n, 22n, 37n],
  [38n, 19n, 10n, 55n, 49n, 18n, 23n, 52n],
  [33n, 4n, 51n, 13n, 34n, 41n, 59n, 17n],
  [5n, 20n, 48n, 41n, 47n, 28n, 16n, 25n],
  [41n, 9n, 37n, 31n, 12n, 47n, 44n, 30n],
  [16n, 34n, 56n, 51n, 4n, 53n, 42n, 41n],
  [31n, 44n, 47n, 46n, 19n, 42n, 44n, 25n],
  [9n, 48n, 35n, 52n, 23n, 31n, 37n, 20n]
];

const PI_256 = [0, 3, 2, 1];
const PI_512 = [2, 1, 4, 7, 6, 5, 0, 3];
const PI_1024 = [0, 9, 2, 13, 6, 11, 4, 15, 10, 7, 12, 3, 14, 5, 8, 1];

const PI_INV_256 = [0, 3, 2, 1];
const PI_INV_512 = [6, 1, 0, 7, 2, 5, 4, 3];
const PI_INV_1024 = [0, 15, 2, 11, 6, 13, 4, 9, 14, 1, 8, 5, 10, 3, 12, 7];

export class Threefish {
  private Nw: number;
  private Nr: number;
  private rot: bigint[][];
  private pi: number[];
  private pi_inv: number[];
  private K: BigUint64Array;
  private t: BigUint64Array;

  constructor(blockSize: 256 | 512 | 1024, key: BigUint64Array) {
    this.Nw = blockSize / 64;
    this.Nr = blockSize === 1024 ? 80 : 72;
    
    if (blockSize === 256) {
      this.rot = ROT_256;
      this.pi = PI_256;
      this.pi_inv = PI_INV_256;
    } else if (blockSize === 512) {
      this.rot = ROT_512;
      this.pi = PI_512;
      this.pi_inv = PI_INV_512;
    } else {
      this.rot = ROT_1024;
      this.pi = PI_1024;
      this.pi_inv = PI_INV_1024;
    }

    this.K = new BigUint64Array(this.Nw + 1);
    let knw = C240;
    for (let i = 0; i < this.Nw; i++) {
      this.K[i] = key[i] || 0n;
      knw ^= this.K[i];
    }
    this.K[this.Nw] = knw;

    this.t = new BigUint64Array(3);
  }

  public encrypt(v: BigUint64Array, tweak: BigUint64Array): void {
    this.t[0] = tweak[0] || 0n;
    this.t[1] = tweak[1] || 0n;
    this.t[2] = this.t[0] ^ this.t[1];

    let e = new BigUint64Array(this.Nw);
    for (let i = 0; i < this.Nw; i++) e[i] = v[i];

    for (let d = 0; d < this.Nr; d++) {
      // Subkey injection
      if (d % 4 === 0) {
        let s = d / 4;
        for (let i = 0; i < this.Nw; i++) {
          let k = this.K[(s + i) % (this.Nw + 1)];
          if (i === this.Nw - 3) k = (k + this.t[s % 3]) % 18446744073709551616n;
          else if (i === this.Nw - 2) k = (k + this.t[(s + 1) % 3]) % 18446744073709551616n;
          else if (i === this.Nw - 1) k = (k + BigInt(s)) % 18446744073709551616n;
          
          e[i] = (e[i] + k) % 18446744073709551616n;
        }
      }

      // Mix
      let f = new BigUint64Array(this.Nw);
      for (let j = 0; j < this.Nw / 2; j++) {
        let r = this.rot[d % 8][j];
        let x0 = e[j * 2];
        let x1 = e[j * 2 + 1];
        let y0 = (x0 + x1) % 18446744073709551616n;
        let y1 = ((x1 << r) | (x1 >> (64n - r))) ^ y0;
        f[j * 2] = BigInt.asUintN(64, y0);
        f[j * 2 + 1] = BigInt.asUintN(64, y1);
      }

      // Permute
      for (let i = 0; i < this.Nw; i++) {
        e[i] = f[this.pi[i]];
      }
    }

    // Final subkey injection
    let s = this.Nr / 4;
    for (let i = 0; i < this.Nw; i++) {
      let k = this.K[(s + i) % (this.Nw + 1)];
      if (i === this.Nw - 3) k = (k + this.t[s % 3]) % 18446744073709551616n;
      else if (i === this.Nw - 2) k = (k + this.t[(s + 1) % 3]) % 18446744073709551616n;
      else if (i === this.Nw - 1) k = (k + BigInt(s)) % 18446744073709551616n;
      
      v[i] = BigInt.asUintN(64, e[i] + k);
    }
  }

  public decrypt(v: BigUint64Array, tweak: BigUint64Array): void {
    this.t[0] = tweak[0] || 0n;
    this.t[1] = tweak[1] || 0n;
    this.t[2] = this.t[0] ^ this.t[1];

    let e = new BigUint64Array(this.Nw);
    for (let i = 0; i < this.Nw; i++) e[i] = v[i];

    // Final subkey extraction
    let s = this.Nr / 4;
    for (let i = 0; i < this.Nw; i++) {
      let k = this.K[(s + i) % (this.Nw + 1)];
      if (i === this.Nw - 3) k = (k + this.t[s % 3]) % 18446744073709551616n;
      else if (i === this.Nw - 2) k = (k + this.t[(s + 1) % 3]) % 18446744073709551616n;
      else if (i === this.Nw - 1) k = (k + BigInt(s)) % 18446744073709551616n;
      
      e[i] = BigInt.asUintN(64, e[i] - k);
    }

    for (let d = this.Nr - 1; d >= 0; d--) {
      // Inverse Permute
      let f = new BigUint64Array(this.Nw);
      for (let i = 0; i < this.Nw; i++) {
        f[i] = e[this.pi_inv[i]];
      }

      // Inverse Mix
      for (let j = 0; j < this.Nw / 2; j++) {
        let r = this.rot[d % 8][j];
        let y0 = f[j * 2];
        let y1 = f[j * 2 + 1];
        let x1_rot = y1 ^ y0;
        let x1 = BigInt.asUintN(64, (x1_rot >> r) | (x1_rot << (64n - r)));
        let x0 = BigInt.asUintN(64, y0 - x1);
        e[j * 2] = x0;
        e[j * 2 + 1] = x1;
      }

      // Subkey extraction
      if (d % 4 === 0) {
        let s = d / 4;
        for (let i = 0; i < this.Nw; i++) {
          let k = this.K[(s + i) % (this.Nw + 1)];
          if (i === this.Nw - 3) k = (k + this.t[s % 3]) % 18446744073709551616n;
          else if (i === this.Nw - 2) k = (k + this.t[(s + 1) % 3]) % 18446744073709551616n;
          else if (i === this.Nw - 1) k = (k + BigInt(s)) % 18446744073709551616n;
          
          e[i] = BigInt.asUintN(64, e[i] - k);
        }
      }
    }

    for (let i = 0; i < this.Nw; i++) v[i] = e[i];
  }
}
