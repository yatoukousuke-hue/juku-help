// 掲示用の QR コード PNG を作る。実行: node dev/make_qr.mjs
import QRCode from 'qrcode';
const BASE = 'https://eimeimizutani-support.vercel.app';
const out = 'docs/掲示物/';
await QRCode.toFile(out + '生徒用QR.png', BASE + '/', { width: 1200, margin: 2, errorCorrectionLevel: 'M' });
await QRCode.toFile(out + '講師用QR.png', BASE + '/teacher', { width: 1200, margin: 2, errorCorrectionLevel: 'M' });
console.log('QR written');
