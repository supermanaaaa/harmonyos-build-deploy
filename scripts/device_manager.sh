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

# 检查 hdc
check_hdc() {
    if ! command -v hdc &> /dev/null; then
        log_error "hdc 未找到，请确保 HarmonyOS SDK 已配置"
        exit 1
    fi
}

# 获取第一个设备
get_first_device() {
    hdc list targets 2>/dev/null | grep -v "^\[" | grep -v "^$" | head -1
}

case "${1:-help}" in
    list)
        check_hdc
        log_info "已连接的设备："
        DEVICES=$(hdc list targets 2>/dev/null | grep -v "^\[" | grep -v "^$" || true)
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
        echo "型号: $(hdc -t "$DEVICE" shell getprop ro.product.model 2>/dev/null || echo '未知')"
        echo "系统版本: $(hdc -t "$DEVICE" shell getprop hw_sc.build.platform.version 2>/dev/null || echo '未知')"
        echo "SDK 版本: $(hdc -t "$DEVICE" shell getprop const.ohos.apiversion 2>/dev/null || echo '未知')"
        echo "序列号: $(hdc -t "$DEVICE" shell getprop ro.serialno 2>/dev/null || echo '未知')"
        ;;
    
    log)
        check_hdc
        DEVICE="${2:-$(get_first_device)}"
        if [[ -z "$DEVICE" ]]; then
            log_error "没有设备连接"
            exit 1
        fi
        log_info "查看设备日志（Ctrl+C 退出）..."
        hdc -t "$DEVICE" hilog
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
        hdc -t "$DEVICE" shell snapshot_display -f /data/local/tmp/screen.png
        hdc -t "$DEVICE" file recv /data/local/tmp/screen.png "./$FILENAME"
        hdc -t "$DEVICE" shell rm /data/local/tmp/screen.png
        log_success "截图已保存: $FILENAME"
        ;;
    
    restart-hdc)
        log_info "重启 hdc 服务..."
        hdc kill 2>/dev/null || true
        sleep 1
        hdc start
        sleep 2
        log_success "hdc 服务已重启"
        hdc list targets
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
        hdc -t "$DEVICE" uninstall "$PKG"
        log_success "卸载完成"
        ;;
    
    help|--help|-h|*)
        show_help
        ;;
esac
