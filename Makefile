#
# Copyright (C) 2024 OpenWrt Community
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dnscrypt-proxy2
PKG_VERSION:=1.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=OpenWrt Community

LUCI_TITLE:=LuCI support for DNSCrypt-Proxy 2
LUCI_DEPENDS:=+luci-base +dnscrypt-proxy2

include $(TOPDIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=$(LUCI_TITLE)
  DEPENDS:=$(LUCI_DEPENDS)
  PKGARCH:=all
endef

define Package/$(PKG_NAME)/description
  $(LUCI_TITLE)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/dnscrypt-proxy2
	$(INSTALL_DATA) htdocs/luci-static/resources/view/dnscrypt-proxy2/*.js $(1)/www/luci-static/resources/view/dnscrypt-proxy2/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) root/usr/share/luci/menu.d/luci-app-dnscrypt-proxy2.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) root/usr/share/rpcd/acl.d/luci-app-dnscrypt-proxy2.json $(1)/usr/share/rpcd/acl.d/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))