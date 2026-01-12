#!/bin/bash

# Vault 密钥备份脚本
# 用于备份 Vault 中存储的所有私钥和配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN}"
VAULT_ROLE_ID="${VAULT_ROLE_ID}"
VAULT_SECRET_ID="${VAULT_SECRET_ID}"
SECRET_PATH="${VAULT_SECRET_PATH:-secret/data/wallet/privatekeys}"
BACKUP_DIR="vault-backup-$(date +%Y%m%d-%H%M%S)"
ENCRYPT_BACKUP="${ENCRYPT_BACKUP:-true}"

echo -e "${GREEN}=== Vault 密钥备份脚本 ===${NC}"
echo "Vault 地址: $VAULT_ADDR"
echo "备份目录: $BACKUP_DIR"
echo ""

# 检查必要的依赖
check_dependencies() {
    local missing_deps=()

    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    if [ "$ENCRYPT_BACKUP" = "true" ] && ! command -v gpg &> /dev/null; then
        echo -e "${YELLOW}⚠️  GPG 未安装，将跳过加密步骤${NC}"
        ENCRYPT_BACKUP="false"
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}✗ 缺少必要的依赖: ${missing_deps[*]}${NC}"
        echo "请安装后重试: brew install ${missing_deps[*]}"
        exit 1
    fi
}

# 获取 Vault Token
get_vault_token() {
    echo -e "${YELLOW}[1/7] 获取 Vault Token...${NC}"

    if [ -n "$VAULT_TOKEN" ]; then
        echo -e "${GREEN}✓ 使用提供的 VAULT_TOKEN${NC}"
        TOKEN="$VAULT_TOKEN"
        export VAULT_ADDR
        export VAULT_TOKEN
        return
    fi

    if [ -z "$VAULT_ROLE_ID" ] || [ -z "$VAULT_SECRET_ID" ]; then
        echo -e "${RED}✗ 请设置 VAULT_TOKEN 或 (VAULT_ROLE_ID + VAULT_SECRET_ID)${NC}"
        exit 1
    fi

    # 使用 AppRole 认证
    AUTH_RESPONSE=$(curl -s --request POST \
        --data "{\"role_id\": \"$VAULT_ROLE_ID\", \"secret_id\": \"$VAULT_SECRET_ID\"}" \
        $VAULT_ADDR/v1/auth/approle/login)

    TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.auth.client_token')

    if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
        echo -e "${RED}✗ AppRole 认证失败${NC}"
        echo "$AUTH_RESPONSE" | jq '.'
        exit 1
    fi

    echo -e "${GREEN}✓ 通过 AppRole 认证成功${NC}"
}

# 检查 Vault 连接
check_vault_connection() {
    echo -e "${YELLOW}[2/7] 检查 Vault 连接...${NC}"

    if ! curl -s -f "$VAULT_ADDR/v1/sys/health" > /dev/null 2>&1; then
        echo -e "${RED}✗ 无法连接到 Vault${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Vault 连接正常${NC}"
}

# 创建备份目录
create_backup_dir() {
    echo -e "${YELLOW}[3/7] 创建备份目录...${NC}"
    mkdir -p "$BACKUP_DIR"
    echo -e "${GREEN}✓ 备份目录已创建: $BACKUP_DIR${NC}"
}

# 备份策略
backup_policies() {
    echo -e "${YELLOW}[4/7] 备份 Vault 策略...${NC}"

    mkdir -p "$BACKUP_DIR/policies"

    # 使用 vault 命令列出策略（更可靠）
    if command -v vault &> /dev/null; then
        POLICIES=$(vault policy list 2>/dev/null | grep -v "^$" || echo "")
    else
        POLICIES=$(curl -s -H "X-Vault-Token: $TOKEN" \
            "$VAULT_ADDR/v1/sys/policies/acl" | jq -r '.data.keys[]? // empty' 2>/dev/null || echo "")
    fi

    if [ -z "$POLICIES" ]; then
        echo -e "${YELLOW}⚠️  未找到策略或无权限访问${NC}"
        return
    fi

    local count=0
    for policy in $POLICIES; do
        if [ "$policy" != "default" ] && [ "$policy" != "root" ]; then
            if command -v vault &> /dev/null; then
                vault policy read "$policy" > "$BACKUP_DIR/policies/$policy.hcl" 2>/dev/null
            else
                curl -s -H "X-Vault-Token: $TOKEN" \
                    "$VAULT_ADDR/v1/sys/policies/acl/$policy" \
                    | jq -r '.data.policy' > "$BACKUP_DIR/policies/$policy.hcl" 2>/dev/null
            fi

            if [ -s "$BACKUP_DIR/policies/$policy.hcl" ]; then
                ((count++))
                echo -e "${GREEN}  ✓ $policy${NC}"
            fi
        fi
    done

    echo -e "${GREEN}✓ 已备份 $count 个策略${NC}"
}

# 备份 AppRole 配置
backup_approles() {
    echo -e "${YELLOW}[5/7] 备份 AppRole 配置...${NC}"

    mkdir -p "$BACKUP_DIR/approles"

    # 列出所有 AppRoles
    ROLES=$(curl -s -X LIST -H "X-Vault-Token: $TOKEN" \
        "$VAULT_ADDR/v1/auth/approle/role" 2>/dev/null | jq -r '.data.keys[]' 2>/dev/null || echo "")

    if [ -z "$ROLES" ]; then
        echo -e "${YELLOW}⚠️  未找到 AppRole 配置${NC}"
        return
    fi

    local count=0
    for role in $ROLES; do
        # 备份 Role 配置
        curl -s -H "X-Vault-Token: $TOKEN" \
            "$VAULT_ADDR/v1/auth/approle/role/$role" \
            > "$BACKUP_DIR/approles/$role.json"

        # 备份 Role ID
        curl -s -H "X-Vault-Token: $TOKEN" \
            "$VAULT_ADDR/v1/auth/approle/role/$role/role-id" \
            > "$BACKUP_DIR/approles/$role-role-id.json"

        ((count++))
    done

    echo -e "${GREEN}✓ 已备份 $count 个 AppRole 配置${NC}"
}

# 备份私钥
backup_private_keys() {
    echo -e "${YELLOW}[6/7] 备份私钥数据...${NC}"

    mkdir -p "$BACKUP_DIR/secrets"

    # 智能处理路径
    # 如果路径包含 /data/，提取基础路径用于 vault CLI
    if [[ "$SECRET_PATH" == *"/data/"* ]]; then
        # secret/data/wallet/privatekeys -> secret/wallet/privatekeys
        BASE_PATH=$(echo "$SECRET_PATH" | sed 's|/data/|/|')
        METADATA_PATH=$(echo "$SECRET_PATH" | sed 's|/data/|/metadata/|')
    else
        BASE_PATH="$SECRET_PATH"
        METADATA_PATH="$SECRET_PATH"
    fi

    echo -e "${BLUE}路径信息:${NC}"
    echo -e "  配置路径: $SECRET_PATH"
    echo -e "  KV CLI 路径: $BASE_PATH"
    echo -e "  API 元数据路径: $METADATA_PATH"
    echo ""

    # 优先使用 vault CLI（更可靠）
    if command -v vault &> /dev/null && [ -n "$VAULT_TOKEN" ]; then
        echo -e "${BLUE}使用 vault CLI 列出密钥...${NC}"
        WALLET_IDS=$(vault kv list -format=json "$BASE_PATH" 2>/dev/null | jq -r '.[]' 2>/dev/null || echo "")
    else
        echo -e "${BLUE}使用 API 列出密钥...${NC}"
        LIST_RESPONSE=$(curl -s -X LIST -H "X-Vault-Token: $TOKEN" \
            "$VAULT_ADDR/v1/$METADATA_PATH" 2>/dev/null)

        WALLET_IDS=$(echo "$LIST_RESPONSE" | jq -r '.data.keys[]' 2>/dev/null || echo "")
    fi

    if [ -z "$WALLET_IDS" ]; then
        echo -e "${YELLOW}⚠️  未找到任何私钥数据${NC}"
        return
    fi

    echo -e "${GREEN}找到 $(echo "$WALLET_IDS" | wc -w | tr -d ' ') 个密钥${NC}"
    echo ""

    local count=0
    local failed=0

    for wallet_id in $WALLET_IDS; do
        # 移除尾部的 / (如果是目录)
        wallet_id="${wallet_id%/}"

        # 优先使用 vault CLI
        if command -v vault &> /dev/null && [ -n "$VAULT_TOKEN" ]; then
            SECRET_DATA=$(vault kv get -format=json "$BASE_PATH/$wallet_id" 2>/dev/null | jq '.data.data' 2>/dev/null)

            if [ "$SECRET_DATA" != "null" ] && [ -n "$SECRET_DATA" ]; then
                echo "$SECRET_DATA" > "$BACKUP_DIR/secrets/$wallet_id.json"
                ((count++))
                echo -e "${GREEN}  ✓ $wallet_id${NC}"
            else
                ((failed++))
                echo -e "${RED}  ✗ $wallet_id (读取失败)${NC}"
            fi
        else
            # 使用 API 获取密钥数据
            SECRET_RESPONSE=$(curl -s -H "X-Vault-Token: $TOKEN" \
                "$VAULT_ADDR/v1/$SECRET_PATH/$wallet_id" 2>/dev/null)

            if echo "$SECRET_RESPONSE" | jq -e '.data.data' > /dev/null 2>&1; then
                echo "$SECRET_RESPONSE" | jq '.data.data' > "$BACKUP_DIR/secrets/$wallet_id.json"
                ((count++))
                echo -e "${GREEN}  ✓ $wallet_id${NC}"
            else
                ((failed++))
                echo -e "${RED}  ✗ $wallet_id (读取失败)${NC}"
            fi
        fi
    done

    echo ""
    echo -e "${GREEN}✓ 已成功备份 $count 个私钥${NC}"
    if [ $failed -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $failed 个私钥备份失败${NC}"
    fi
}

# 生成备份清单
generate_manifest() {
    echo -e "${YELLOW}[7/7] 生成备份清单...${NC}"

    cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "backup_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "vault_addr": "$VAULT_ADDR",
  "secret_path": "$SECRET_PATH",
  "statistics": {
    "policies": $(ls -1 "$BACKUP_DIR/policies" 2>/dev/null | wc -l | tr -d ' '),
    "approles": $(ls -1 "$BACKUP_DIR/approles"/*role-id.json 2>/dev/null | wc -l | tr -d ' '),
    "secrets": $(ls -1 "$BACKUP_DIR/secrets" 2>/dev/null | wc -l | tr -d ' ')
  }
}
EOF

    echo -e "${GREEN}✓ 备份清单已生成${NC}"
}

# 加密备份
encrypt_backup() {
    if [ "$ENCRYPT_BACKUP" = "false" ]; then
        return
    fi

    echo -e "${YELLOW}加密备份...${NC}"

    # 创建压缩包
    tar czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"

    # 加密
    gpg --symmetric --cipher-algo AES256 "$BACKUP_DIR.tar.gz"

    # 删除未加密的文件
    rm "$BACKUP_DIR.tar.gz"

    echo -e "${GREEN}✓ 备份已加密: $BACKUP_DIR.tar.gz.gpg${NC}"
    echo -e "${YELLOW}⚠️  请妥善保管加密密码${NC}"
}

# 显示摘要
show_summary() {
    echo ""
    echo -e "${GREEN}=== 备份完成 ===${NC}"
    echo ""

    if [ "$ENCRYPT_BACKUP" = "true" ] && [ -f "$BACKUP_DIR.tar.gz.gpg" ]; then
        echo "加密备份文件: $BACKUP_DIR.tar.gz.gpg"
        echo ""
        echo "恢复方法:"
        echo -e "  ${YELLOW}gpg --decrypt $BACKUP_DIR.tar.gz.gpg > $BACKUP_DIR.tar.gz${NC}"
        echo -e "  ${YELLOW}tar xzf $BACKUP_DIR.tar.gz${NC}"
    else
        echo "备份目录: $BACKUP_DIR"
        echo ""
        cat "$BACKUP_DIR/manifest.json" | jq '.'
    fi

    echo ""
    echo -e "${YELLOW}建议:${NC}"
    echo "1. 将备份文件存储到安全的位置（如加密的云存储）"
    echo "2. 定期测试备份恢复流程"
    echo "3. 保留多个历史备份版本"
    echo "4. 记录备份加密密码（如果使用加密）"
    echo ""
}

# 主函数
main() {
    check_dependencies
    get_vault_token
    check_vault_connection
    create_backup_dir
    backup_policies
    backup_approles
    backup_private_keys
    generate_manifest
    encrypt_backup
    show_summary
}

# 运行主函数
main
