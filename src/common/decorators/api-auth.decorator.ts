import { SetMetadata } from '@nestjs/common';

/**
 * 标记接口为公开访问，不需要 API Key 认证
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * 要求特定角色才能访问
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
