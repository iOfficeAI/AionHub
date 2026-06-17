/**
 * 小龙虾修图技能 - 主程序
 * Sharp 图片处理: 压缩/缩放/裁剪/格式转换/去背景等
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const [,, cmd, input, output, ...rest] = process.argv;

async function main() {
  if (!cmd) {
    console.log(`
🦞 小龙虾修图技能
用法:
  node修图.js compress  <输入> <输出> [质量1-100]
  node修图.js resize    <输入> <输出> <宽> [高]
  node修图.js format    <输入> <输出> <jpg|png|webp>
  node修图.js info      <图片路径>
  node修图.js crop      <输入> <输出> <宽> <高> <left> <top>
  node修图.js rotate    <输入> <输出> <角度>
  node修图.js flipv     <输入> <输出>
  node修图.js fliph     <输入> <输出>
  node修图.js blur      <输入> <输出> [sigma]
  node修图.js sharpen   <输入> <输出>
  node修图.js negate    <输入> <输出>
  node修图.js bw        <输入> <输出>
  node修图.js watermark <输入> <输出> <文字>
示例:
  node修图.js compress "a.jpg" "b.jpg" 70
  node修图.js resize   "a.jpg" "b.jpg" 800 600
  node修图.js info     "a.jpg"
  node修图.js watermark "a.jpg" "b.jpg" "小龙虾水印"
`);
    return;
  }

  if (!input) {
    console.error('❌ 缺少参数'); return;
  }

  const inp = path.resolve(input);
  if (!fs.existsSync(inp)) {
    console.error('❌ 文件不存在:', inp); return;
  }

  // Info mode
  if (cmd === 'info') {
    const meta = await sharp(inp).metadata();
    const size = fs.statSync(inp).size;
    console.log(`📋 ${path.basename(inp)}`);
    console.log(`   尺寸: ${meta.width} × ${meta.height}`);
    console.log(`   格式: ${meta.format} | 通道: ${meta.channels} | 色彩: ${meta.space}`);
    console.log(`   大小: ${(size/1024).toFixed(1)} KB`);
    return;
  }

  if (!output) { console.error('❌ 缺少输出路径'); return; }
  const out = path.resolve(output);

  let pipeline = sharp(inp);

  switch (cmd) {
    case 'compress': {
      const q = parseInt(output) || 70;
      const fmt = path.extname(out).slice(1).toLowerCase();
      if (fmt === 'jpg' || fmt === 'jpeg') pipeline = pipeline.jpeg({ quality: q });
      else if (fmt === 'png') pipeline = pipeline.png({ compressionLevel: Math.floor(9 - q/11) });
      else if (fmt === 'webp') pipeline = pipeline.webp({ quality: q });
      else pipeline = pipeline.jpeg({ quality: q });
      await pipeline.toFile(out);
      const ns = fs.statSync(out).size;
      const os = fs.statSync(inp).size;
      console.log(`✅ 压缩: ${(os/1024).toFixed(0)} KB → ${(ns/1024).toFixed(0)} KB (质量${q})`);
      console.log(`   输出: ${out}`);
      break;
    }
    case 'resize': {
      const w = parseInt(output);
      const h = rest[0] ? parseInt(rest[0]) : null;
      await pipeline.resize(w, h, { fit: h ? 'fill' : 'inside', withoutEnlargement: true }).toFile(out);
      console.log(`✅ 缩放: ${w}${h ? 'x'+h : ''} → ${out}`);
      break;
    }
    case 'format': {
      const fmt = output;
      if (fmt === 'jpg') pipeline = pipeline.jpeg({ quality: 85 });
      else if (fmt === 'png') pipeline = pipeline.png();
      else if (fmt === 'webp') pipeline = pipeline.webp({ quality: 85 });
      else { console.error('不支持:', fmt); return; }
      await pipeline.toFile(out);
      console.log(`✅ 格式转换: ${fmt} → ${out}`);
      break;
    }
    case 'crop': {
      const w = parseInt(output), h = parseInt(rest[0]), left = parseInt(rest[1]), top = parseInt(rest[2]);
      await pipeline.extract({ left, top, width: w, height: h }).toFile(out);
      console.log(`✅ 裁剪: ${w}×${h} at (${left},${top}) → ${out}`);
      break;
    }
    case 'rotate': {
      await pipeline.rotate(parseInt(output)).toFile(out);
      console.log(`✅ 旋转: ${output}° → ${out}`);
      break;
    }
    case 'flipv': { await pipeline.flip().toFile(out); console.log(`✅ 垂直翻转 → ${out}`); break; }
    case 'fliph': { await pipeline.flop().toFile(out); console.log(`✅ 水平翻转 → ${out}`); break; }
    case 'blur': {
      const s = parseFloat(output) || 3;
      await pipeline.blur(s).toFile(out);
      console.log(`✅ 模糊 (sigma=${s}) → ${out}`);
      break;
    }
    case 'sharpen': { await pipeline.sharpen().toFile(out); console.log(`✅ 锐化 → ${out}`); break; }
    case 'negate': { await pipeline.negate().toFile(out); console.log(`✅ 反色 → ${out}`); break; }
    case 'bw': { await pipeline.grayscale().toFile(out); console.log(`✅ 黑白 → ${out}`); break; }
    case 'watermark': {
      const text = output;
      const w = (await sharp(inp).metadata()).width;
      const fs2 = Math.max(16, Math.floor(w / 20));
      const svg = `<svg width="${w}" height="${fs2+20}"><style>.t{fill:white;opacity:0.7;font-size:${fs2}px;font-family:sans-serif;font-weight:bold;}</style><text x="10" y="${fs2+5}" class="t">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text></svg>`;
      await pipeline.composite([{ input: Buffer.from(svg), top: 10, left: 10 }]).toFile(out);
      console.log(`✅ 水印: "${text}" → ${out}`);
      break;
    }
    default:
      console.error('❌ 未知命令:', cmd);
  }
}

main().catch(err => { console.error('❌ 错误:', err.message); process.exit(1); });
