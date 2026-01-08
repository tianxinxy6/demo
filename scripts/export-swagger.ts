import { writeFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

/**
 * 从运行中的服务器导出 Swagger JSON 文档
 * 使用前请确保服务器正在运行: npm run start:dev
 */
async function exportSwaggerDocument(
  serverUrl: string,
  path: string,
  outputFileName: string,
  description: string,
) {
  const url = `${serverUrl}/${path}/json`;

  console.log(`📡 正在获取 ${description}...`);
  console.log(`   URL: ${url}`);

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const document = response.data;

    // 确保 docs 目录存在
    const docsDir = join(process.cwd(), 'docs');
    const outputPath = join(docsDir, outputFileName);

    // 写入文件
    writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

    console.log(`✅ ${description} 已导出到: ${outputPath}`);
    return true;
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error(`❌ 无法连接到服务器 (${url})`);
      console.error(`   错误: 连接被拒绝`);
    } else if (error.code === 'ENOTFOUND') {
      console.error(`❌ 无法找到服务器 (${url})`);
      console.error(`   错误: 域名解析失败`);
    } else if (error.response) {
      console.error(`❌ ${description} 导出失败 (${url})`);
      console.error(`   HTTP 状态码: ${error.response.status}`);
      console.error(`   错误信息: ${error.response.statusText}`);
    } else {
      console.error(`❌ ${description} 导出失败 (${url})`);
      console.error(`   错误: ${error.message}`);
    }
    return false;
  }
}

async function exportSwagger() {
  const serverUrl = process.env.API_DOMAIN || 'http://localhost:3000';
  const swaggerPath = process.env.SWAGGER_PATH || 'docs';

  console.log('🚀 开始导出 Swagger 文档...');
  console.log('');

  let allSuccess = true;

  // 导出完整 API 文档
  const success1 = await exportSwaggerDocument(
    serverUrl,
    swaggerPath,
    'swagger.json',
    '完整 API 文档',
  );
  allSuccess = allSuccess && success1;
  console.log('');

  // 导出商户 API 文档
  const success2 = await exportSwaggerDocument(
    serverUrl,
    'merchant-docs',
    'swagger-merchant.json',
    '商户 API 文档',
  );
  allSuccess = allSuccess && success2;
  console.log('');

  if (allSuccess) {
    console.log('🎉 所有文档导出完成！');
    console.log('');
    console.log('📝 生成 HTML 文档，请运行:');
    console.log('   npm run docs:html');
    console.log('');
    console.log('🌐 HTML 文档将生成到:');
    console.log('   - docs/api.html (完整文档)');
    console.log('   - docs/api-merchant.html (商户文档)');
    process.exit(0);
  } else {
    console.error('');
    console.error('⚠️  部分文档导出失败');
    console.error('');
    console.error('💡 请确保服务器正在运行:');
    console.error('   npm run start:dev');
    console.error('');
    console.error('然后在新终端窗口运行:');
    console.error('   npm run docs:export');
    process.exit(1);
  }
}

exportSwagger();
