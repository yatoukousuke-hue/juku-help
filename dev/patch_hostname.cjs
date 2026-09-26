// Vercel CLI 対策: PC名が日本語（フ）だと HTTP ヘッダに載せられず落ちるため、英数字に置き換える
const os = require('os');
os.hostname = () => 'pc';
