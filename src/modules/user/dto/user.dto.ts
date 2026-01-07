import { StringField } from '@/common/decorators/field.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsRepeat } from '@/common/validators/repeat.validator';
import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional } from 'class-validator';

/**
 * 用户注册 DTO
 */
export class UserRegisterDto {
  @StringField({ minLength: 3, maxLength: 50 })
  @ApiProperty({ example: 'john_doe', description: '用户名' })
  username: string;

  @StringField({ minLength: 6, maxLength: 100 })
  @ApiProperty({ example: 'password123', description: '密码' })
  password: string;

  @StringField({ minLength: 6, maxLength: 100 })
  @IsRepeat('password', { message: '确认密码与密码不一致' })
  @ApiProperty({ example: 'password123', description: '确认密码' })
  confirmPassword: string;

  @StringField({ required: false, maxLength: 50 })
  @ApiProperty({ example: 'John Doe', description: '昵称', required: false })
  nickname?: string;
}

/**
 * 用户登录 DTO
 */
export class UserLoginDto {
  @StringField({ minLength: 3, maxLength: 50 })
  @ApiProperty({ example: 'john_doe', description: '用户名' })
  username: string;

  @StringField({ minLength: 6, maxLength: 100 })
  @ApiProperty({ example: 'password123', description: '密码' })
  password: string;
}

/**
 * 修改密码请求 DTO
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: '当前密码',
    example: 'currentPassword123',
  })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description: '新密码',
    example: 'newPassword123',
    minLength: 6,
    maxLength: 32,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: '密码长度不能少于6位' })
  @MaxLength(32, { message: '密码长度不能超过32位' })
  newPassword: string;

  @ApiProperty({
    description: '确认新密码',
    example: 'newPassword123',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

/**
 * 设置密码 DTO
 */
export class SetPasswordDto {
  @ApiProperty({
    description: '交易密码',
    example: '123456',
    minLength: 6,
    maxLength: 32,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: '密码长度不能少于6位' })
  @MaxLength(32, { message: '密码长度不能超过32位' })
  password: string;

  @ApiProperty({
    description: '确认密码',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

/**
 * 更新用户信息 DTO
 */
export class UpdateUserDto {
  @IsOptional()
  @StringField({ required: false, maxLength: 50 })
  @ApiProperty({ example: 'John Doe', description: '昵称', required: false })
  nickname?: string;
}
