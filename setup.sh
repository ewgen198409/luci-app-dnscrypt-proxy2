#!/bin/bash
# OpenWrt SDK Setup Script

set -e

# Update feeds
./scripts/feeds update -a
./scripts/feeds install -a

# Create initial .config
make defconfig

echo "SDK setup complete"
