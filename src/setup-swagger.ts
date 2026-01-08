import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { API_SECURITY_AUTH } from './common/decorators/swagger.decorator';
import { CommonEntity } from './common/entities/common.entity';
import { ResOp, TreeResult } from './common/vo/response.model';
import { MerchantModule } from './modules/merchant/merchant.module';

export function setupSwagger(app: INestApplication, configService: ConfigService) {
  const appConfig = configService.get('app')!;
  const { name, swagger } = appConfig;
  const { enable } = swagger;

  // 默认的 Swagger 配置
  const path = configService.get('SWAGGER_PATH', 'docs');
  const serverUrl = configService.get('API_DOMAIN', 'http://localhost:3000');

  if (!enable) return;

  const swaggerPath = `${serverUrl}/${path}`;
  const baseUrl = `${serverUrl}/${appConfig.api.prefix}`;

  const documentBuilder = new DocumentBuilder()
    .setTitle(name)
    .setDescription(
      `
🔷 **Base URL**: \`${baseUrl}\` <br>
📦 **API 版本控制**: 本 API 支持多版本控制 <br>
  - V1: \`${baseUrl}/v1/...\` <br>
  - V2: \`${baseUrl}/v2/...\` <br>
🧾 **Swagger JSON**: [查看文档 JSON](${swaggerPath}/json) <br>
ℹ️ **版本说明**:
  - V1 为稳定版本，包含所有基础功能
  - V2 为增强版本，提供新功能和改进
  - 未指定版本时，默认使用 V1`,
    )
    .setVersion('1.0')
    .addServer(`${baseUrl}/v1`, 'API V1 (默认版本)')
    .addServer(`${baseUrl}/v2`, 'API V2 (增强版本)')
    .addServer(baseUrl, 'Base URL (使用默认版本)');

  // auth security
  documentBuilder.addSecurity(API_SECURITY_AUTH, {
    description: '输入令牌（Enter the token）',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  const document = SwaggerModule.createDocument(app, documentBuilder.build(), {
    ignoreGlobalPrefix: true,
    extraModels: [CommonEntity, ResOp, TreeResult],
  });

  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true, // 保持登录
    },
    jsonDocumentUrl: `/${path}/json`,
  });

  return () => {
    // started log
    const logger = new Logger('SwaggerModule');
    logger.log(`Swagger UI: ${swaggerPath}`);
    logger.log(`Swagger JSON: ${swaggerPath}/json`);
  };
}

/**
 * 设置商户 API 独立的 Swagger 文档
 * 仅包含 Merchant 模块的 API，供客户使用
 */
export function setupMerchantSwagger(app: INestApplication, configService: ConfigService) {
  const appConfig = configService.get('app')!;
  const { swagger } = appConfig;
  const { enable } = swagger;

  const path = 'merchant-docs'; // 商户文档路径
  const serverUrl = configService.get('API_DOMAIN', 'http://localhost:3000');

  if (!enable) return;

  const swaggerPath = `${serverUrl}/${path}`;
  const baseUrl = `${serverUrl}/${appConfig.api.prefix}`;

  const documentBuilder = new DocumentBuilder()
    .setTitle('商户 API 文档')
    .setDescription(
      `
🔷 **Base URL**: \`${baseUrl}\` <br>
📦 **API 版本控制**: 本 API 支持多版本控制 <br>
  - V1: \`${baseUrl}/v1/merchant/...\` <br>
🧾 **Swagger JSON**: [查看文档 JSON](${swaggerPath}/json) <br>
ℹ️ **说明**:
  - 本文档仅包含商户相关的 API 接口
  - 使用商户密钥进行身份验证
  - 所有接口均需要正确的签名和鉴权`,
    )
    .setVersion('1.0')
    .addServer(`${baseUrl}/v1`, 'API V1 (当前版本)')
    .addServer(baseUrl, 'Base URL (使用默认版本)');

  // auth security
  documentBuilder.addSecurity(API_SECURITY_AUTH, {
    description: '输入商户令牌（Enter merchant token）',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  // 只包含 Merchant 相关的模块
  const document = SwaggerModule.createDocument(app, documentBuilder.build(), {
    ignoreGlobalPrefix: true,
    include: [MerchantModule],
    extraModels: [CommonEntity, ResOp, TreeResult],
  });

  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true, // 保持登录
      tagsSorter: 'alpha', // 标签按字母排序
      operationsSorter: 'alpha', // 操作按字母排序
    },
    jsonDocumentUrl: `/${path}/json`,
  });

  return () => {
    // started log
    const logger = new Logger('MerchantSwaggerModule');
    logger.log(`Merchant Swagger UI: ${swaggerPath}`);
    logger.log(`Merchant Swagger JSON: ${swaggerPath}/json`);
  };
}
