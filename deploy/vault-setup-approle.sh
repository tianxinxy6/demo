#!/bin/bash

# Vault AppRole 设置脚本
# 用于创建和配置 Vault AppRole 认证

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-dev-root-token}"
ROLE_NAME="${VAULT_ROLE_NAME:-wallet-app}"
POLICY_NAME="${VAULT_POLICY_NAME:-wallet-policy}"
SECRET_PATH="${VAULT_SECRET_PATH:-secret/data/wallet/privatekeys}"

echo -e "${GREEN}=== Vault AppRole 设置脚本 ===${NC}"
echo "Vault 地址: $VAULT_ADDR"
echo "角色名称: $ROLE_NAME"
echo "策略名称: $POLICY_NAME"
echo "密钥路径: $SECRET_PATH"
echo ""

# 检查 Vault 是否可用
echo -e "${YELLOW}[1/6] 检查 Vault 连接...${NC}"
if ! curl -s -f "$VAULT_ADDR/v1/sys/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ 无法连接到 Vault，请确保 Vault 正在运行${NC}"
    echo -e "${YELLOW}提示: 启动 Vault 开发模式${NC}"
    echo -e "  vault server -dev -dev-root-token-id=dev-root-token"
    exit 1
fi
echo -e "${GREEN}✓ Vault 连接正常${NC}"

# 导出环境变量供 vault 命令使用
export VAULT_ADDR
export VAULT_TOKEN

# 验证 Token 是否有效
echo -e "${YELLOW}验证 Token...${NC}"
TOKEN_LOOKUP=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/auth/token/lookup-self" 2>/dev/null)
if echo "$TOKEN_LOOKUP" | grep -q "permission denied\|invalid token"; then
    echo -e "${RED}✗ Token 无效或没有足够权限${NC}"
    echo ""
    echo -e "${YELLOW}如果您在使用 dev 模式，正确的 token 可能是:${NC}"

    # 尝试从进程中提取 dev token
    DEV_TOKEN=$(ps aux | grep "vault server -dev" | grep -o "dev-root-token-id=[^ ]*" | cut -d= -f2 | head -1)
    if [ -n "$DEV_TOKEN" ]; then
        echo -e "${GREEN}  找到 dev token: $DEV_TOKEN${NC}"
        echo ""
        echo "请使用以下命令重新运行:"
        echo -e "${YELLOW}  export VAULT_TOKEN='$DEV_TOKEN'${NC}"
        echo -e "${YELLOW}  ./scripts/vault-setup-approle.sh${NC}"
    else
        echo -e "  ${GREEN}dev-root-token${NC} (默认 dev token)"
    fi
    echo ""
    echo "或者查看 Vault 启动日志中的 Root Token"
    exit 1
fi
echo -e "${GREEN}✓ Token 验证成功${NC}"
echo ""

# 启用 AppRole 认证方法
echo -e "${YELLOW}[2/6] 启用 AppRole 认证方法...${NC}"
if vault auth list | grep -q "approle/"; then
    echo -e "${GREEN}✓ AppRole 已启用${NC}"
else
    vault auth enable approle
    echo -e "${GREEN}✓ AppRole 认证方法已启用${NC}"
fi
echo ""

# 创建策略文件
echo -e "${YELLOW}[3/6] 创建访问策略...${NC}"
cat > /tmp/vault-${POLICY_NAME}.hcl <<EOF
# 允许读写私钥路径
path "${SECRET_PATH}/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# 允许列出私钥
path "${SECRET_PATH%%/data/*}/metadata/wallet/privatekeys/*" {
  capabilities = ["list", "read"]
}

# 允许列出根路径
path "${SECRET_PATH%%/data/*}/metadata/wallet/privatekeys" {
  capabilities = ["list"]
}
EOF

vault policy write $POLICY_NAME /tmp/vault-${POLICY_NAME}.hcl
rm /tmp/vault-${POLICY_NAME}.hcl
echo -e "${GREEN}✓ 策略 '$POLICY_NAME' 已创建${NC}"
echo ""

# 创建或更新 AppRole
echo -e "${YELLOW}[4/6] 创建 AppRole...${NC}"
vault write auth/approle/role/$ROLE_NAME \
    token_ttl=1h \
    token_max_ttl=4h \
    secret_id_ttl=0 \
    secret_id_num_uses=0 \
    policies="$POLICY_NAME"
echo -e "${GREEN}✓ AppRole '$ROLE_NAME' 已创建/更新${NC}"
echo ""

# 获取 Role ID
echo -e "${YELLOW}[5/6] 获取 Role ID...${NC}"
ROLE_ID=$(vault read -field=role_id auth/approle/role/$ROLE_NAME/role-id)
echo -e "${GREEN}✓ Role ID: $ROLE_ID${NC}"
echo ""

# 生成 Secret ID
echo -e "${YELLOW}[6/6] 生成 Secret ID...${NC}"
SECRET_ID=$(vault write -field=secret_id -f auth/approle/role/$ROLE_NAME/secret-id)
echo -e "${GREEN}✓ Secret ID: $SECRET_ID${NC}"
echo ""

# 测试认证
echo -e "${YELLOW}测试 AppRole 认证...${NC}"
TEST_TOKEN=$(curl -s --request POST \
  --data "{\"role_id\": \"$ROLE_ID\", \"secret_id\": \"$SECRET_ID\"}" \
  $VAULT_ADDR/v1/auth/approle/login | grep -o '"client_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEST_TOKEN" ]; then
    echo -e "${GREEN}✓ 认证测试成功${NC}"
else
    echo -e "${RED}✗ 认证测试失败${NC}"
    exit 1
fi
echo ""

# 生成配置输出
echo -e "${GREEN}=== 配置完成 ===${NC}"
echo ""
echo "请将以下配置添加到您的 .env 文件："
echo ""
echo -e "${YELLOW}VAULT_ADDR=$VAULT_ADDR"
echo "VAULT_SECRET_PATH=$SECRET_PATH"
echo "VAULT_ROLE_ID=$ROLE_ID"
echo "VAULT_SECRET_ID=$SECRET_ID${NC}"
echo ""

# 保存凭证到文件（可选）
OUTPUT_FILE="vault-credentials-$(date +%Y%m%d-%H%M%S).txt"
cat > $OUTPUT_FILE <<EOF
# Vault AppRole 凭证
# 生成时间: $(date)

VAULT_ADDR=$VAULT_ADDR
VAULT_SECRET_PATH=$SECRET_PATH
VAULT_ROLE_ID=$ROLE_ID
VAULT_SECRET_ID=$SECRET_ID

# 注意：请妥善保管此文件，建议加密存储
EOF

echo -e "${GREEN}✓ 凭证已保存到: $OUTPUT_FILE${NC}"
echo -e "${RED}⚠️  请妥善保管此文件，建议使用加密存储或删除${NC}"
echo ""

# 显示后续步骤
echo -e "${YELLOW}=== 后续步骤 ===${NC}"
echo "1. 将上述环境变量添加到 .env 文件"
echo "2. 使用以下命令加密凭证文件（可选）："
echo -e "   ${YELLOW}gpg --symmetric --cipher-algo AES256 $OUTPUT_FILE${NC}"
echo "3. 使用 backup-vault-secrets.sh 脚本备份所有密钥"
echo "4. 定期轮换 Secret ID 以提高安全性"
echo ""
