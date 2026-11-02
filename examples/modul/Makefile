# SPDX-License-Identifier: GPL-2.0-only
# Ağaç dışı modül derlemesi. Kullanım:
#   make KDIR=<çekirdek çıktı dizini> ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu-
obj-m := ornek_bilgi.o

KDIR ?= /lib/modules/$(shell uname -r)/build

all:
	$(MAKE) -C $(KDIR) M=$(CURDIR) modules

modules_install:
	$(MAKE) -C $(KDIR) M=$(CURDIR) modules_install

clean:
	$(MAKE) -C $(KDIR) M=$(CURDIR) clean
