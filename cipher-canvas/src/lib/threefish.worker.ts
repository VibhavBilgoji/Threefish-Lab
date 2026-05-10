import { Threefish } from './threefish';

export type ThreefishWorkerRequest = {
  id: string;
  mode: 'encrypt' | 'decrypt';
  blockData: Uint8ClampedArray;
  blockSize: 256 | 512 | 1024;
  tweak: string; // 16 hex chars ideally, or any string
  key: string;
};

export type ThreefishWorkerResponse = {
  id: string;
  result: Uint8ClampedArray;
  error?: string;
};

function stringToBigUint64Array(str: string, words: number): BigUint64Array {
  const arr = new BigUint64Array(words);
  for (let i = 0; i < words; i++) {
    let num = 0n;
    for (let j = 0; j < 8; j++) {
      const charCode = str.charCodeAt(i * 8 + j) || 0;
      num = (num << 8n) | BigInt(charCode);
    }
    arr[i] = num;
  }
  return arr;
}

// Ensure the Uint8ClampedArray length matches the block size perfectly.
// 256 bits = 32 bytes
// 512 bits = 64 bytes
// 1024 bits = 128 bytes
self.onmessage = (e: MessageEvent<ThreefishWorkerRequest>) => {
  const { id, mode, blockData, blockSize, tweak, key } = e.data;

  try {
    const bytesPerBlock = blockSize / 8;
    if (blockData.length !== bytesPerBlock) {
      throw new Error(`Invalid block data length. Expected ${bytesPerBlock}, got ${blockData.length}`);
    }

    const words = blockSize / 64;
    const keyArr = stringToBigUint64Array(key.padEnd(words * 8, '0'), words);
    const tweakArr = stringToBigUint64Array(tweak.padEnd(16, '0'), 2);

    const cipher = new Threefish(blockSize, keyArr);

    // Convert Uint8ClampedArray to BigUint64Array
    const dataArr = new BigUint64Array(words);
    const dataView = new DataView(blockData.buffer, blockData.byteOffset, blockData.byteLength);
    for (let i = 0; i < words; i++) {
      dataArr[i] = dataView.getBigUint64(i * 8, true); // Little endian
    }

    if (mode === 'encrypt') {
      cipher.encrypt(dataArr, tweakArr);
    } else {
      cipher.decrypt(dataArr, tweakArr);
    }

    // Convert back to Uint8ClampedArray
    const result = new Uint8ClampedArray(bytesPerBlock);
    const resultView = new DataView(result.buffer);
    for (let i = 0; i < words; i++) {
      resultView.setBigUint64(i * 8, dataArr[i], true);
    }

    self.postMessage({ id, result } as ThreefishWorkerResponse);
  } catch (err: any) {
    self.postMessage({ id, result: new Uint8ClampedArray(0), error: err.message } as ThreefishWorkerResponse);
  }
};
