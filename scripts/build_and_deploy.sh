#!/bin/bash
#
# HarmonyOS 一键编译部署脚本
# 用法: bash build_and_deploy.sh [选项]
#
# 选项:
#   -a, --all               编译所有模块（推荐多模块项目使用）
#   -p, --project <path>    项目路径（默认当前目录）
#   -m, --module <name>     模块名称（默认 entry）
#   -b, --build-mode <mode> 构建模式: debug|release（默认 debug）
#   -d, --device <id>       目标设备 ID（默认自动选择第一个）
#   -s, --skip-build        跳过编译，直接安装
#   -l, --launch            安装后启动应用
#   -c, --clean             编译前清理
#   -h, --help              显示帮助信息
#

set -e

# 默认配置
PROJECT_PATH="."
MODULE_NAME="entry"
BUILD_MODE="debug"
DEVICE_ID=""
SKIP_BUILD=false
LAUNCH_APP=false
CLEAN_BUILD=false
BUILD_ALL=false

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 跨平台寻找工具：先 PATH，再 DevEco Studio 安装目录，再用户级 SDK。
# 用法：find_tool <name> [extra_subpath_under_deveco_contents...]
# 第一个 extra 参数应是相对 .app/Contents 或 DevEco 安装根的子路径，
# 例如 tools/ohpm/bin/ohpm 或 tools/hvigor/bin/hvigorw。
find_tool() {
    local name="$1"
    shift

    if command -v "$name" &>/dev/null; then
        command -v "$name"
        return 0
    fi

    local deveco_roots=()
    case "$(uname -s)" in
        Darwin)
            for app in /Applications/DevEco*Studio*.app "$HOME/Applications"/DevEco*Studio*.app; do
                [[ -d "$app" ]] || continue
                deveco_roots+=("$app/Contents")
            done
            ;;
        Linux)
            [[ -d /opt/deveco-studio ]] && deveco_roots+=(/opt/deveco-studio)
            [[ -d "$HOME/devecostudio" ]] && deveco_roots+=("$HOME/devecostudio")
            ;;
    esac

    # 1. DevEco 安装目录里的固定子路径（hvigorw / ohpm 等）
    for sub in "$@"; do
        for root in "${deveco_roots[@]}"; do
            if [[ -x "$root/$sub" ]]; then
                echo "$root/$sub"
                return 0
            fi
        done
    done

    # 2. 兜底：在 DevEco 安装目录与用户级 SDK 下搜索 toolchains/<name>（适合 hdc）
    local sdk_roots=("${deveco_roots[@]/%//sdk}")
    case "$(uname -s)" in
        Darwin)
            sdk_roots+=("$HOME/Library/Huawei/Sdk" "$HOME/Library/Huawei/sdk" "$HOME/Library/OpenHarmony/Sdk")
            ;;
        Linux)
            sdk_roots+=("$HOME/OpenHarmony/Sdk")
            ;;
    esac
    for root in "${sdk_roots[@]}"; do
        [[ -d "$root" ]] || continue
        local found
        found=$(find "$root" -maxdepth 5 -type f -path "*/toolchains/$name" 2>/dev/null | head -1)
        if [[ -n "$found" ]]; then
            echo "$found"
            return 0
        fi
    done

    return 1
}

show_help() {
    head -20 "$0" | tail -15
    exit 0
}

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project)   PROJECT_PATH="$2"; shift 2 ;;
        -m|--module)    MODULE_NAME="$2"; shift 2 ;;
        -b|--build-mode) BUILD_MODE="$2"; shift 2 ;;
        -d|--device)    DEVICE_ID="$2"; shift 2 ;;
        -s|--skip-build) SKIP_BUILD=true; shift ;;
        -l|--launch)    LAUNCH_APP=true; shift ;;
        -c|--clean)     CLEAN_BUILD=true; shift ;;
        -a|--all)       BUILD_ALL=true; shift ;;
        -h|--help)      show_help ;;
        *)              log_error "未知参数: $1"; exit 1 ;;
    esac
done

# 检查项目路径
if [[ ! -d "$PROJECT_PATH" ]]; then
    log_error "项目路径不存在: $PROJECT_PATH"
    exit 1
fi

cd "$PROJECT_PATH"
log_info "工作目录: $(pwd)"

# 检查是否为鸿蒙项目
if [[ ! -f "build-profile.json5" ]]; then
    log_error "当前目录不是有效的鸿蒙项目（缺少 build-profile.json5）"
    exit 1
fi

# 检测构建工具 hvigorw
HVIGOR_CMD=""
if [[ -f "hvigorw" ]]; then
    HVIGOR_CMD="./hvigorw"
elif [[ -f "hvigorw.bat" ]] && [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    HVIGOR_CMD="./hvigorw.bat"
else
    HVIGOR_CMD=$(find_tool hvigorw tools/hvigor/bin/hvigorw || true)
fi
if [[ -z "$HVIGOR_CMD" ]]; then
    log_error "找不到 hvigorw 构建工具"
    log_info "请确保项目根目录有 hvigorw，或安装 DevEco Studio，或全局安装: npm install -g @ohos/hvigor-cli"
    exit 1
fi
log_info "使用构建工具: $HVIGOR_CMD"

# 检测 hdc：先 PATH，再 DevEco SDK toolchains（Mac 默认不在 PATH）
HDC=$(find_tool hdc || true)
if [[ -z "$HDC" ]]; then
    log_error "找不到 hdc 工具"
    log_info "请安装 DevEco Studio，或把 HarmonyOS SDK 的 toolchains 加入 PATH"
    exit 1
fi
log_info "使用 hdc: $HDC"

# 检测 ohpm（可选，仅在需要 ohpm install 时使用）
OHPM=$(find_tool ohpm tools/ohpm/bin/ohpm || true)

# 获取设备列表
log_info "检查连接的设备..."
DEVICES=$("$HDC" list targets 2>/dev/null | grep -v "^\[" | grep -v "^$" || true)

if [[ -z "$DEVICES" ]]; then
    log_error "没有检测到已连接的设备"
    log_info "请确保："
    log_info "  1. 设备已通过 USB 连接"
    log_info "  2. 设备已开启 USB 调试"
    log_info "  3. 电脑已授权调试"
    exit 1
fi

# 选择设备
if [[ -z "$DEVICE_ID" ]]; then
    DEVICE_ID=$(echo "$DEVICES" | head -1)
    DEVICE_COUNT=$(echo "$DEVICES" | wc -l)
    if [[ $DEVICE_COUNT -gt 1 ]]; then
        log_warn "检测到多个设备，使用第一个: $DEVICE_ID"
        log_info "可用设备列表:"
        echo "$DEVICES" | while read -r dev; do echo "  - $dev"; done
    fi
fi

log_info "目标设备: $DEVICE_ID"

# 清理构建
if [[ "$CLEAN_BUILD" == true ]]; then
    log_info "清理构建缓存..."
    $HVIGOR_CMD clean --no-daemon 2>&1 || true
fi

# 编译项目
if [[ "$SKIP_BUILD" == false ]]; then
    if [[ "$BUILD_ALL" == true ]]; then
        log_info "开始编译所有模块（模式: $BUILD_MODE）..."
        BUILD_CMD="$HVIGOR_CMD assembleHap -p product=default -p buildMode=${BUILD_MODE} --no-daemon"
    else
        log_info "开始编译模块 '$MODULE_NAME'（模式: $BUILD_MODE）..."
        BUILD_CMD="$HVIGOR_CMD assembleHap --mode module -p module=${MODULE_NAME}@default -p product=default -p buildMode=${BUILD_MODE} --no-daemon"
    fi
    
    log_info "执行: $BUILD_CMD"
    
    # 捕获输出和错误
    BUILD_OUTPUT=$($BUILD_CMD 2>&1) || BUILD_EXIT_CODE=$?
    
    echo "$BUILD_OUTPUT"
    
    if [[ -n "$BUILD_EXIT_CODE" ]] && [[ "$BUILD_EXIT_CODE" -ne 0 ]]; then
        log_error "编译失败"
        echo ""
        log_info "常见编译错误："
        log_info "  1. ArkTS 语法错误 - 检查上方显示的文件和行号"
        log_info "  2. 缺少依赖 - 运行: ohpm install"
        log_info "  3. SDK 版本不匹配 - 检查 build-profile.json5 中的 compileSdkVersion"
        log_info "  4. 签名配置错误 - 检查 build-profile.json5 中的 signingConfigs"
        if [[ "$BUILD_ALL" == false ]]; then
            echo ""
            log_warn "提示: 多模块项目请尝试 -a 参数编译所有模块"
        fi
        exit 1
    fi
    
    log_success "编译完成"
fi

# 查找 HAP 文件
HAP_DIR="${MODULE_NAME}/build/default/outputs/default"
HAP_FILE=""

# 优先查找签名包
if [[ -f "${HAP_DIR}/${MODULE_NAME}-default-signed.hap" ]]; then
    HAP_FILE="${HAP_DIR}/${MODULE_NAME}-default-signed.hap"
elif [[ -f "${HAP_DIR}/${MODULE_NAME}-default-unsigned.hap" ]]; then
    HAP_FILE="${HAP_DIR}/${MODULE_NAME}-default-unsigned.hap"
    log_warn "使用未签名的 HAP 包，可能无法在真机上安装"
else
    # 尝试查找任意 HAP 文件
    HAP_FILE=$(find "${HAP_DIR}" -name "*.hap" -type f 2>/dev/null | head -1)
fi

if [[ -z "$HAP_FILE" ]] || [[ ! -f "$HAP_FILE" ]]; then
    log_error "找不到 HAP 文件，请检查编译输出"
    log_info "期望路径: ${HAP_DIR}/"
    exit 1
fi

log_info "HAP 文件: $HAP_FILE"

# 安装应用
log_info "正在安装到设备 $DEVICE_ID ..."

INSTALL_OUTPUT=$("$HDC" -t "$DEVICE_ID" install "$HAP_FILE" 2>&1) || INSTALL_EXIT_CODE=$?

echo "$INSTALL_OUTPUT"

if [[ -n "$INSTALL_EXIT_CODE" ]] && [[ "$INSTALL_EXIT_CODE" -ne 0 ]]; then
    log_error "安装失败"
    echo ""
    log_info "常见原因："
    log_info "  1. 签名证书不匹配 - 证书与之前安装时使用的不一致"
    log_info "  2. 设备未授权安装 - 检查设备上的开发者选项"
    log_info "  3. 应用版本冲突 - 尝试先卸载: hdc -t $DEVICE_ID uninstall <包名>"
    log_info "  4. 存储空间不足 - 清理设备存储空间"
    exit 1
fi

log_success "安装成功！"

# 启动应用
if [[ "$LAUNCH_APP" == true ]]; then
    # 从 app.json5 或 module.json5 读取包名和 Ability 名
    BUNDLE_NAME=""
    ABILITY_NAME=""
    
    if [[ -f "AppScope/app.json5" ]]; then
        BUNDLE_NAME=$(grep -o '"bundleName"[[:space:]]*:[[:space:]]*"[^"]*"' AppScope/app.json5 | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    fi
    
    if [[ -f "${MODULE_NAME}/src/main/module.json5" ]]; then
        ABILITY_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*Ability[^"]*"' "${MODULE_NAME}/src/main/module.json5" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    fi
    
    if [[ -z "$BUNDLE_NAME" ]]; then
        log_warn "无法自动获取包名，跳过启动"
    elif [[ -z "$ABILITY_NAME" ]]; then
        ABILITY_NAME="EntryAbility"
        log_info "使用默认 Ability: $ABILITY_NAME"
    fi
    
    if [[ -n "$BUNDLE_NAME" ]]; then
        log_info "启动应用: $BUNDLE_NAME / $ABILITY_NAME"
        "$HDC" -t "$DEVICE_ID" shell aa start -a "$ABILITY_NAME" -b "$BUNDLE_NAME" || log_warn "启动失败，请手动打开应用"
    fi
fi

log_success "部署完成！"
