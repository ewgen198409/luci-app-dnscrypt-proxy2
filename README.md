# luci-app-dnscrypt-proxy2

LuCI interface for DNSCrypt-Proxy 2 on OpenWrt

## Description

This package provides a user-friendly web interface (LuCI) for managing DNSCrypt-Proxy 2 on OpenWrt routers. It allows you to configure all major DNSCrypt-Proxy settings without editing configuration files manually.

## Features

- **Service Management**: Start, stop, and restart DNSCrypt-Proxy directly from the web interface
- **Real-time Status**: Monitor service status with automatic refresh
- **Server Selection**: Browse and select from available DNSCrypt/DoH servers with checkboxes
- **Full Configuration**: Access all DNSCrypt-Proxy settings organized in tabs:
  - General (listen addresses, max clients, server names)
  - Servers (IPv4/IPv6, DNSCrypt, DoH, ODoH filters)
  - Connection (TCP, HTTP/3, timeouts, proxies)
  - Network (bootstrap resolvers, offline mode)
  - Load Balancing (strategy, hot reload)
  - Caching (DNS cache settings)
  - Filters (IPv6 blocking, unqualified names)
  - Certificates (DNSSEC, TLS settings)
  - Logging (log levels, file management)
  - Configuration (raw config viewer/editor)

- **Multi-language Support**: English and Russian interfaces
- **Auto Language Detection**: Automatically detects router language setting

## Requirements

- OpenWrt 24.x or newer
- LuCI web interface
- dnscrypt-proxy2 package installed

## Installation

### From OpenWrt Package Feed

```bash
opkg update
opkg install luci-app-dnscrypt-proxy2
```

### Manual Installation

1. Transfer the IPK file to your router:
```bash
scp luci-app-dnscrypt-proxy2_1.0-r1_all.ipk root@192.168.1.1:/tmp/
```

2. Install the package:
```bash
ssh root@192.168.1.1
opkg install /tmp/luci-app-dnscrypt-proxy2_1.0-r1_all.ipk
```

## Usage

1. Open LuCI web interface
2. Navigate to **Services** → **DNSCrypt-Proxy 2**
3. Configure your settings and click **Save** or **Save & Apply**

### Selecting Servers

Click the **Select Server** button next to "Server Names" or "Disabled Servers" to:
- View all available DNSCrypt/DoH servers
- Search by name or address
- Select multiple servers using checkboxes
- Add selected servers to your configuration

### Redirect DNS

Use the **Redirect DNS** button to configure your router to use DNSCrypt-Proxy:
- Method 1: Via LuCI (Network → DHCP and DNS → Advanced)
- Method 2: Via SSH terminal (command provided)

## Building from Source

### Using OpenWrt SDK

```bash
# Clone or download the SDK
cd openwrt-sdk-*

# Copy package to packages directory
cp -r luci-app-dnscrypt-proxy2 package/

# Configure
make menuconfig

# Select: LuCI → Applications → luci-app-dnscrypt-proxy2

# Build
make package/luci-app-dnscrypt-proxy2/compile
```

### Build Output

The compiled IPK will be located at:
```
bin/packages/aarch64_generic/base/luci-app-dnscrypt-proxy2_1.0-r1_all.ipk
```

## Screenshots

### Main Interface
- Service status with Start/Stop/Restart buttons
- Current server display
- Tabbed configuration interface

### Server Selection
- Modal dialog with server list
- Checkbox selection
- Search functionality
- Multi-select support

## Files Structure

```
luci-app-dnscrypt-proxy2/
├── Makefile                              # OpenWrt package makefile
├── htdocs/
│   └── luci-static/
│       └── resources/
│           └── view/
│               └── dnscrypt-proxy2/
│                   └── dnscrypt-proxy2.js  # Main UI application
├── root/
│   └── usr/
│       ├── share/
│       │   ├── luci/
│       │   │   └── menu.d/
│       │   │       └── luci-app-dnscrypt-proxy2.json  # Menu entry
│       │   └── rpcd/
│       │       └── acl.d/
│       │           └── luci-app-dnscrypt-proxy2.json  # RPC permissions
└── README.md
```

## License

GPL-3.0-or-later - See LICENSE file

## Author

OpenWrt Community

## Contributing

Contributions are welcome! Please submit pull requests or open issues on the project repository.
