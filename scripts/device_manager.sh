#!/bin/bash
#
# HarmonyOS 设备管理工具
# 用法: bash device_manager.sh <命令> [参数]
#
# 命令:
#   list              列出所有连接的设备
#   info <device>     显示设备详细信息
#   log <device>      查看设备日志（实时）
#   screenshot <dev>  截取设备屏幕
#   restart-hdc       重启 hdc 服务
#   uninstall <dev> <pkg>  卸载应用
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    head -15 "$0" | tail -11
    exit 0
}

# 跨平台寻找 hdc：PATH → DevEco Studio sdk 下 toolchains
find_hdc() {
    if command -v hdc &>/dev/null; then
        command -v hdc
        return 0
    fi
    local sdk_roots=()
    case "$(uname -s)" in
        Darwin)
            for app in /Applications/DevEco*Studio*.app "$HOME/Applications"/DevEco*Studio*.app; do
                [[ -d "$app" ]] && sdk_roots+=("$app/Contents/sdk")
            done
            sdk_roots+=("$HOME/Library/Huawei/Sdk" "$HOME/Library/Huawei/sdk" "$HOME/Library/OpenHarmony/Sdk")
            ;;
        Linux)
            [[ -d /opt/deveco-studio/sdk ]] && sdk_roots+=(/opt/deveco-studio/sdk)
            sdk_roots+=("$HOME/devecostudio/sdk" "$HOME/OpenHarmony/Sdk")
            ;;
    esac
    for root in "${sdk_roots[@]}"; do
        [[ -d "$root" ]] || continue
        local found
        found=$(find "$root" -maxdepth 5 -type f -path "*/toolchains/hdc" 2>/dev/null | head -1)
        [[ -n "$found" ]] && { echo "$found"; return 0; }
    done
    return 1
}

# 解析 hdc 路径并校验存在
HDC=""
check_hdc() {
    HDC=$(find_hdc || true)
    if [[ -z "$HDC" ]]; then
        log_error "hdc 未找到，请安装 DevEco Studio 或把 HarmonyOS SDK toolchains 加入 PATH"
        exit 1
    fi
}

# 获取第一个设备
get_first_device() {
    "$HDC" list targets 2>/dev/null | grep -v "^\[" | grep -v "^$" | head -1
}

case "${1:-help}" in
    list)
        check_hdc
        log_info "已连接的设备："
        DEVICES=$("$HDC" list targets 2>/dev/null | grep -v "^\[" | grep -v "^$" || true)
        if [[ -z "$DEVICES" ]]; then
            log_error "没有检测到设备"
        else
            echo "$DEVICES" | while read -r dev; do
                echo "  📱 $dev"
            done
        fi
        ;;
    
    info)
        check_hdc
        DEVICE="${2:-$(get_first_device)}"
        if [[ -z "$DEVICE" ]]; then
            log_error "没有设备连接"
            exit 1
        fi
        log_info "设备信息: $DEVICE"
        echo "----------------------------------------"
        echo "品牌: $("$HDC" -t "$DEVICE" shell param get const.product.brand 2>/dev/null || echo '未知')"
        echo "型号: $("$HDC" -t "$DEVICE" shell param get const.product.model 2>/dev/null || echo '未知')"
        echo "系统版本: $("$HDC" -t "$DEVICE" shell param get const.product.software.version 2>/dev/null || echo '未知')"
        echo "API 版本: $("$HDC" -t "$DEVICE" shell param get const.ohos.apiversion 2>/dev/null || echo '未知')"
        echo "序列号: $("$HDC" -t "$DEVICE" shell param get const.product.serial 2>/dev/null || echo '未知')"
        ;;
    
    log)
        check_hdc
        DEVICE="${2:-$(get_first_device)}"
        if [[ -z "$DEVICE" ]]; then
            log_error "没有设备连接"
            exit 1
        fi
        log_info "查看设备日志（Ctrl+C 退出）..."
        "$HDC" -t "$DEVICE" hilog
        ;;
    
    screenshot)
        check_hdc
        DEVICE="${2:-$(get_first_device)}"
        if [[ -z "$DEVICE" ]]; then
            log_error "没有设备连接"
            exit 1
        fi
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        FILENAME="screenshot_${TIMESTAMP}.png"
        log_info "截取屏幕..."
        "$HDC" -t "$DEVICE" shell snapshot_display -f /data/local/tmp/screen.png
        "$HDC" -t "$DEVICE" file recv /data/local/tmp/screen.png "./$FILENAME"
        "$HDC" -t "$DEVICE" shell rm /data/local/tmp/screen.png
        log_success "截图已保存: $FILENAME"
        ;;
    
    restart-hdc)
        check_hdc
        log_info "重启 hdc 服务..."
        "$HDC" kill 2>/dev/null || true
        sleep 1
        "$HDC" start
        sleep 2
        log_success "hdc 服务已重启"
        "$HDC" list targets
        ;;
    
    uninstall)
        check_hdc
        DEVICE="${2:-$(get_first_device)}"
        PKG="$3"
        if [[ -z "$DEVICE" ]]; then
            log_error "没有设备连接"
            exit 1
        fi
        if [[ -z "$PKG" ]]; then
            log_error "请指定包名: device_manager.sh uninstall <device> <package>"
            exit 1
        fi
        log_info "卸载 $PKG ..."
        "$HDC" -t "$DEVICE" uninstall "$PKG"
        log_success "卸载完成"
        ;;
    
    help|--help|-h|*)
        show_help
        ;;
esac
