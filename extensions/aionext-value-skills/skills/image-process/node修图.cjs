/**
 * 小龙虾修图技能
 * 直接调用 sharp，修图功能无需额外安装
 *
 * 用法:
 *   node修图.js compress <输入> <输出> [质量]
 *   node修图.js resize   <输入> <输出> <宽> <高>
 *   node修图.js format   <输入> <输出> <格式>   (jpg/png/webp)
 *   node修图.js info     <图片路径>
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
  node node修图.js compress <输入> <输出> [质量1-100]
  node node修图.js resize   <输入> <输出> <宽> <高>
  node node修图.js format   <输入> <输出> <jpg|png|webp>
  node node修图.js info     <图片路径>
  node node修图.js crop     <输入> <输出> <宽> <高> <left> <top>
  node node修图.js rotate   <输入> <输出> <角度>
  node node修图.js flipv    <输入> <输出>          垂直翻转
  node node修图.js fliph    <输入> <输出>          水平翻转
  node node修图.js blur     <输入> <输出> [sigma]  模糊
  node node修图.js sharpen  <输入> <输出>           锐化
  node node修图.js negate   <输入> <输出>           反色
  node node修图.js bw       <输入> <输出>           黑白
  node node修图.js watermark <输入> <输出> <文字>  加水印文字
示例:
  node node修图.js compress "a.jpg" "b.jpg" 70
  node node修图.js resize   "a.jpg" "b.jpg" 800 600
  node node修图.js format   "a.png" "b.webp" webp
  node node修图.js info     "a.jpg"
`);
    return;
  }

  if (!input || !output) {
    console.error('❌ 缺少输入或输出路径');
    return;
  }

  const inp = path.resolve(input);
  const out = path.resolve(output);

  if (!fs.existsSync(inp)) {
    console.error('❌ 文件不存在:', inp);
    return;
  }

  let pipeline = sharp(inp);

  switch (cmd) {
    case 'info': {
      const meta = await sharp(inp).metadata();
      console.log(`📋 图片信息: ${path.basename(inp)}`);
      console.log(`   格式: ${meta.format}`);
      console.log(`   尺寸: ${meta.width} × ${meta.height}`);
      console.log(`   通道: ${meta.channels}`);
      console.log(`   色彩空间: ${meta.space}`);
      const size = fs.statSync(inp).size;
      console.log(`   文件大小: ${(size/1024).toFixed(1)} KB`);
      return;
    }

    case 'compress': {
      const q = parseInt(rest[0]) || 70;
      const fmt = path.extname(out).slice(1).toLowerCase();
      if (fmt === 'jpg' || fmt === 'jpeg') {
        await pipeline.jpeg({ quality: q, mozjpeg: true }).toFile(out);
      } else if (fmt === 'png') {
        await pipeline.png({ compressionLevel: Math.floor(q / 10) }).toFile(out);
      } else if (fmt === 'webp') {
        await pipeline.webp({ quality: q }).toFile(out);
      } else {
        await pipeline.jpeg({ quality: q }).toFile(out);
      }
      const newSize = fs.statSync(out).size;
      const origSize = fs.statSync(inp).size;
      console.log(`✅ 压缩完成: ${(origSize/1024).toFixed(1)} KB → ${(newSize/1024).toFixed(1)} KB  (质量${
        q})`);
      console.log(`   输出: ${out}`);
      break;
    }

    case 'resize': {
      const w = parseInt(output);
      const h = parseInt(rest[0]);
      await pipeline.resize(w, h, { fit: 'inside', withoutEnlargement: true }).toFile(out);
      console.log(`✅ 缩放完成: ${w}×${h} → ${out}`);
      break;
    }

    case 'format': {
      const fmt = rest[0] || 'jpg';
      if (fmt === 'jpg') await pipeline.jpeg({ quality: 85 }).toFile(out);
      else if (fmt === 'png') await pipeline.png().toFile(out);
      else if (fmt === 'webp') await pipeline.webp({ quality: 85 }).toFile(out);
      else { console.error('不支持的格式:', fmt); return; }
      console.log(`✅ 格式转换完成: ${fmt} → ${out}`);
      break;
    }

    case 'crop': {
      const w = parseInt(output);
      const h = parseInt(rest[0]);
      const left = parseInt(rest[1]);
      const top = parseInt(rest[2]);
      await pipeline.extract({ left, top, width: w, height: h }).toFile(out);
      console.log(`✅ 裁剪完成: ${w}×${h} at (${left},${top}) → ${out}`);
      break;
    }

    case 'rotate': {
      const angle = parseInt(output);
      await pipeline.rotate(angle).toFile(out);
      console.log(`✅ 旋转完成: ${angle}° → ${out}`);
      break;
    }

    case 'flipv': {
      await pipeline.flip().toFile(out);
      console.log(`✅ 垂直翻转完成 → ${out}`);
      break;
    }

    case 'fliph': {
      await pipeline.flop().toFile(out);
      console.log(`✅ 水平翻转完成 → ${out}`);
      break;
    }

    case 'blur': {
      const sigma = parseFloat(output) || 3;
      await pipeline.blur(sigma).toFile(out);
      console.log(`✅ 模糊完成 (sigma=${sigma}) → ${out}`);
      break;
    }

    case 'sharpen': {
      await pipeline.sharpen().toFile(out);
      console.log(`✅ 锐化完成 → ${out}`);
      break;
    }

    case 'negate': {
      await pipeline.negate().toFile(out);
      console.log(`✅ 反色完成 → ${out}`);
      break;
    }

    case 'bw': {
      await pipeline.grayscale().toFile(out);
      console.log(`✅ 黑白转换完成 → ${out}`);
      break;
    }

    case 'watermark': {
      const text = output;
      const width = (await sharp(inp).metadata()).width;
      const fontSize = Math.max(16, Math.floor(width / 20));
      const svgText = `<svg width="${width}" height="${fontSize + 20}">
        <style>.w{fill:white;opacity:0.7;font-size:${fontSize}px;font-family:sans-serif;font-weight:bold;}</style>
        <text x="10" y="${fontSize + 5}" class="w">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>
      </svg>`;
      await sharp(inp).composite([{ input: Buffer.from(svgText), top: 10, left: 10 }]).toFile(out);
      console.log(`✅ 水印添加完成: "${text}" → ${out}`);
      break;
    }

    default:
      console.error('❌ 未知命令:', cmd);
      console.log('   运行 node修图.js 无参数查看帮助');
  }
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
