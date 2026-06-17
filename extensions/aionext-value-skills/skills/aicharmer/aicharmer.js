#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync, spawn } = require('child_process');

// ============ 配置 ============

const MINIMAX_CLI = 'mmx';
const OUTPUT_DIR = process.env.OPENCLAW_OUTPUT_DIR
    || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : null)
    || (process.env.HOME ? path.join(process.env.HOME, 'Desktop') : null)
    || process.cwd();

// ============ 从环境变量读取配置 ============

function readConfig() {
    const sfKey = (process.env.SILICONFLOW_API_KEY || '').trim();
    const mxKey = (process.env.MINIMAX_API_KEY || '').trim();

    return {
        siliconflow: sfKey ? {
            apiKey: sfKey,
            apiBase: 'api.siliconflow.cn',
            imageModel: 'Qwen/Qwen-Image',
            videoModel: 'Wan-AI/Wan2.2-T2V-A14B'
        } : null,
        minimax: mxKey && mxKey !== '（用户自己接入的 MiniMax API Key，留空或填写）' ? { apiKey: mxKey } : null
    };
}

// ============ 模型检测 ============

function detectMiniMax() {
    const model = process.env.OPENCLAW_MODEL || '';
    const vendor = process.env.OPENCLAW_VENDOR || '';

    const check = (str) => str.toLowerCase().includes('minimax');

    return check(model) || check(vendor);
}

// ============ MiniMax CLI 管理 ============

function isMMXInstalled() {
    try {
        if (process.platform === 'win32') {
            execFileSync('where', [MINIMAX_CLI], { encoding: 'utf8', stdio: 'pipe' });
        } else {
            execSync(`command -v ${MINIMAX_CLI}`, { encoding: 'utf8', stdio: 'pipe' });
        }
        return true;
    } catch {
        return false;
    }
}

function installMMX() {
    console.log('📦 正在安装 MiniMax CLI (mmx)...');
    try {
        execSync('npm install -g mmx-cli --registry https://registry.npmmirror.com', {
            stdio: 'inherit',
            encoding: 'utf8',
            timeout: 120000
        });
        console.log('✅ MiniMax CLI 安装完成');
        return true;
    } catch (e) {
        console.error('❌ 安装失败:', e.message);
        return false;
    }
}

function setupMMXAuth(apiKey) {
    console.log('🔑 正在配置 MiniMax API Key...');
    try {
        execFileSync(MINIMAX_CLI, ['auth', 'login', '--api-key', apiKey], {
            stdio: 'inherit',
            encoding: 'utf8',
            timeout: 30000
        });
        console.log('✅ MiniMax 认证完成');
        return true;
    } catch (e) {
        console.error('❌ 认证失败:', e.message);
        return false;
    }
}

function ensureMMXReady(config) {
    // 检查 CLI 是否安装
    if (!isMMXInstalled()) {
        console.error('❌ 未找到 MiniMax CLI。请先安装 mmx-cli，或改用 --provider siliconflow。');
        return false;
    }

    // 检查是否已配置 Key
    try {
        execSync('mmx quota', { encoding: 'utf8', stdio: 'pipe' });
        // 已配置
        return true;
    } catch {
        // 未配置，尝试用配置的 Key
        if (config && config.minimax && config.minimax.apiKey) {
            return setupMMXAuth(config.minimax.apiKey);
        }
        console.warn('⚠️ MiniMax 未配置 API Key，将尝试匿名使用');
        return true; // 继续尝试
    }
}

// ============ MiniMax Provider ============

async function generateImageMiniMax(prompt, save) {
    console.log('🎨 [MiniMax] 正在生成图片...');
    console.log(`   提示词: ${prompt}`);

    const outFile = `/tmp/aicharmer_${Date.now()}.png`;

    return new Promise((resolve) => {
        try {
            // mmx image "prompt" --out output.png
            execSync(`mmx image "${prompt}" --out ${outFile}`, {
                stdio: 'inherit',
                encoding: 'utf8',
                timeout: 120000
            });

            if (fs.existsSync(outFile)) {
                console.log('\n✅ 图片生成成功！');
                if (save) {
                    const dest = path.join(OUTPUT_DIR, `aicharmer_${Date.now()}.png`);
                    fs.copyFileSync(outFile, dest);
                    console.log(`   已保存: ${dest}`);
                }
                resolve(true);
            } else {
                console.error('❌ 未找到生成的文件');
                resolve(false);
            }
        } catch (e) {
            console.error('❌ MiniMax 图片生成失败:', e.message);
            resolve(false);
        }
    });
}

async function generateVideoMiniMax(imageUrl, prompt, save) {
    console.log('🎬 [MiniMax] 正在生成视频...');
    console.log(`   提示词: ${prompt}`);

    const outFile = save ? path.join(OUTPUT_DIR, `aicharmer_${Date.now()}.mp4`) : path.join(process.cwd(), `aicharmer_${Date.now()}.mp4`);

    return new Promise((resolve) => {
        try {
            // 视频生成命令
            // mmx video generate --prompt "xxx" --download out.mp4
            // 注意：MiniMax 视频是异步的，需要处理
            execFileSync(MINIMAX_CLI, ['video', 'generate', '--prompt', prompt, '--download', outFile, '--wait'], {
                stdio: 'inherit',
                encoding: 'utf8',
                timeout: 300000 // 5分钟等待
            });

            if (fs.existsSync(outFile)) {
                console.log('\n✅ 视频生成成功！');
                console.log(`   已保存: ${outFile}`);
                resolve(true);
            } else {
                // 可能 --wait 不可用，尝试异步方式
                console.log('⏳ 视频生成中（异步模式）...');
                try {
                    const taskOutput = execSync(`mmx video generate --prompt "${prompt}"`, {
                        encoding: 'utf8',
                        timeout: 10000
                    });
                    // 解析 task id
                    const taskIdMatch = taskOutput.match(/task[-_]?id[:\s]+(\d+)/i) || taskOutput.match(/(\d{10,})/);
                    if (taskIdMatch) {
                        const taskId = taskIdMatch[1];
                        console.log(`   Task ID: ${taskId}`);
                        console.log('   轮询等待完成...');

                        // 轮询直到完成
                        for (let i = 0; i < 60; i++) {
                            sleepSync(5000);
                            const status = execSync(`mmx video task get --task-id ${taskId}`, { encoding: 'utf8' });
                            if (status.includes(' succeed') || status.includes('completed') || status.includes('done')) {
                                // 下载视频
                                const dlMatch = status.match(/file[-_]?id[:\s]+(\d+)/i);
                                if (dlMatch) {
                                    execSync(`mmx video download --file-id ${dlMatch[1]} --out ${outFile}`, { stdio: 'inherit' });
                                }
                                break;
                            }
                            process.stdout.write('.');
                        }
                    }
                } catch (e2) {
                    console.error('❌ 异步获取失败:', e2.message);
                }
                resolve(true);
            }
        } catch (e) {
            console.error('❌ MiniMax 视频生成失败:', e.message);
            resolve(false);
        }
    });
}

// ============ SiliconFlow Provider ============

function sfRequest(method, pathname, body, apiKey) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.siliconflow.cn',
            port: 443,
            path: pathname,
            method: method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        https.get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => resolve(filePath));
        }).on('error', reject);
    });
}

function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function waitForVideoSF(requestId, apiKey) {
    const start = Date.now();
    while (Date.now() - start < 600000) {
        process.stdout.write('.');
        const res = await sfRequest('POST', '/v1/video/status', { requestId }, apiKey);
        if (res.status === 'Succeed') {
            console.log('\n✅ 视频生成完成！');
            return res.results;
        }
        if (res.status === 'Failed') throw new Error(`失败: ${res.reason}`);
        await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error('视频生成超时');
}

async function generateImageSF(prompt, save, config) {
    console.log('🎨 [SiliconFlow] 正在生成图片...');
    console.log(`   提示词: ${prompt}`);
    console.log(`   模型: ${config.imageModel}`);

    const res = await sfRequest('POST', '/v1/images/generations', {
        model: config.imageModel,
        prompt,
        image_size: '1024x1024',
        num_images: 1
    }, config.apiKey);

    if (res.images && res.images[0]) {
        const img = res.images[0];
        console.log('\n✅ 图片生成成功！');
        console.log(`   URL: ${img.url}`);
        if (save) {
            const dest = path.join(OUTPUT_DIR, `aicharmer_${Date.now()}.png`);
            await downloadFile(img.url, dest);
            console.log(`   已保存: ${dest}`);
        }
    } else {
        console.error('❌ 生成失败:', res);
    }
}

async function generateVideoSF(imageUrl, prompt, save, config) {
    console.log('🎬 [SiliconFlow] 正在提交视频生成任务...');
    console.log(`   图片: ${imageUrl}`);
    console.log(`   描述: ${prompt}`);

    const submit = await sfRequest('POST', '/v1/video/submit', {
        model: config.videoModel,
        image_url: imageUrl,
        prompt,
        duration: 5
    }, config.apiKey);

    if (!submit.requestId) {
        console.error('❌ 提交失败:', submit);
        return;
    }

    console.log('\n⏳ 视频生成中，请稍候（约1-5分钟）...');
    const results = await waitForVideoSF(submit.requestId, config.apiKey);

    if (results && results.videos && results.videos[0]) {
        const vid = results.videos[0];
        console.log('\n✅ 视频生成成功！');
        console.log(`   URL: ${vid.url}`);
        if (save) {
            const dest = path.join(OUTPUT_DIR, `aicharmer_${Date.now()}.mp4`);
            await downloadFile(vid.url, dest);
            console.log(`   已保存: ${dest}`);
        }
    }
}

// ============ 帮助 ============

function printHelp() {
    console.log(`
🤖 aicharmer - AI 图片与视频生成助手（智能路由版）

📸 生成图片:
   node aicharmer.js image "你的图片描述" [--save]

🎬 生成视频:
   node aicharmer.js video "图片URL" "视频描述" [--save]

🔄 Provider 选择:
   --provider minimax      强制 MiniMax CLI
   --provider siliconflow  强制 SiliconFlow API
   （默认自动检测：MiniMax模型 → MiniMax CLI，否则 → SiliconFlow）

💡 添加 --save 或 -s 自动保存到桌面

🌐 Provider:
   - MiniMax CLI (检测到 minimax 模型时自动用)
   - SiliconFlow API (默认)
`);
}

// ============ 主入口 ============

async function main() {
    const args = process.argv.slice(2);

    if (!args.length || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
        printHelp();
        return;
    }

    // 加载配置
    const config = readConfig();

    // 解析参数
    let cmd = null;
    let provider = 'auto';
    let save = false;
    let pargs = [];

    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--save' || a === '-s') {
            save = true;
        } else if ((a === '--provider' || a === '-p') && args[i + 1] && !args[i + 1].startsWith('--')) {
            provider = args[++i];
        } else if (!a.startsWith('--')) {
            if (!cmd) cmd = a;
            else pargs.push(a);
        }
    }

    // 检测模型决定 provider
    if (provider === 'auto') {
        if (detectMiniMax()) {
            // MiniMax 模型
            if (ensureMMXReady(config)) {
                provider = 'minimax';
                console.log('🟢 检测到 MiniMax，使用 MiniMax CLI');
            } else {
                console.warn('⚠️ MiniMax CLI 不可用，切换到 SiliconFlow');
                provider = 'siliconflow';
            }
        } else {
            provider = 'siliconflow';
            console.log('🔵 使用 SiliconFlow API');
        }
    }

    // 执行
    try {
        if (cmd === 'image') {
            if (!pargs[0]) {
                console.error('❌ 请提供图片描述'); return;
            }
            const prompt = pargs.join(' ');

            if (provider === 'minimax') {
                await generateImageMiniMax(prompt, save);
            } else {
                if (!config?.siliconflow) {
                    console.error('❌ SiliconFlow 未配置'); return;
                }
                await generateImageSF(prompt, save, config.siliconflow);
            }
        } else if (cmd === 'video') {
            if (!pargs[0] || !pargs[1]) {
                console.error('❌ 请提供图片URL和视频描述'); return;
            }
            const [imageUrl, prompt] = pargs;

            if (provider === 'minimax') {
                await generateVideoMiniMax(imageUrl, prompt, save);
            } else {
                if (!config?.siliconflow) {
                    console.error('❌ SiliconFlow 未配置'); return;
                }
                await generateVideoSF(imageUrl, prompt, save, config.siliconflow);
            }
        } else {
            console.error(`❌ 未知命令: ${cmd}`);
            printHelp();
        }
    } catch (e) {
        console.error('❌ 错误:', e.message);
    }
}

main();
